(ns latticework.tts
  (:require [clojure.string :as str]
            [latticework.lipsync :as lipsync]
            [latticework.protocol :as protocol]
            [latticework.vocal :as vocal]))

(def agency-name "tts")

(def default-config
  {:engine "webSpeech"
   :rate 1.0
   :pitch 1.0
   :volume 1.0
   :voiceName ""
   :lang ""
   :lipsyncIntensity 1.0
   :jawScale 1.0
   :azureVisualLeadMs 35})

(def default-state
  {:status "idle"
   :currentText nil
   :currentTimeline []
   :currentVoice nil
   :utteranceId nil
   :cancelledUtteranceIds []
   :wordIndex 0
   :error nil
   :config default-config
   :eventCount 0
   :lastUpdatedTime nil})

(defn- now []
  (.round js/Math (protocol/now-ms)))

(defn- finite-number? [value]
  (and (number? value) (.isFinite js/Number value)))

(defn- number-or [value fallback]
  (if (finite-number? value) value fallback))

(defn- normalize-config [config]
  (merge default-config (select-keys (or config {}) (keys default-config))))

(defn create-state
  ([] (create-state nil))
  ([config]
   (atom (assoc default-state :config (normalize-config config)))))

(defn snapshot [state]
  @state)

(defn tts-state [state]
  (select-keys @state [:status :currentText :currentTimeline :currentVoice :utteranceId :cancelledUtteranceIds :error]))

(defn- state-output [state]
  (protocol/emit-state agency-name @state))

(defn- event-output [event]
  {:type "ttsEvent"
   :agency agency-name
   :event (assoc event :timestamp (now))})

(defn- timeline-output [utterance-id timeline vocal-timeline emotion-events]
  {:type "ttsTimeline"
   :agency agency-name
   :utteranceId utterance-id
   :timeline timeline
   :vocalTimeline vocal-timeline
   :emotionEvents emotion-events})

(defn- command-output [target command]
  {:type "agencyCommand"
   :agency agency-name
   :target target
   :command command})

(defn- result [value outputs]
  {:result value :outputs outputs})

(defn- update-state! [state update-fn]
  (swap! state
         (fn [current]
           (-> current
               update-fn
               (update :eventCount inc)
               (assoc :lastUpdatedTime (now))))))

(defn- next-utterance-id []
  (str "utt_" (now) "_" (.floor js/Math (* (.random js/Math) 100000))))

(def max-cancelled-utterances 12)

(defn- remember-cancelled [ids utterance-id]
  (if utterance-id
    (->> (conj (vec (or ids [])) utterance-id)
         distinct
         (take-last max-cancelled-utterances)
         vec)
    (vec (or ids []))))

(defn- cancelled-utterance? [state utterance-id]
  (boolean (some #(= % utterance-id) (:cancelledUtteranceIds @state))))

(defn- stale-utterance? [state utterance-id]
  (or (nil? utterance-id)
      (cancelled-utterance? state utterance-id)
      (not= utterance-id (:utteranceId @state))))

(defn- stale-utterance-result [state event-type utterance-id]
  (result false [(event-output {:type "STALE_UTTERANCE_IGNORED"
                                :eventType event-type
                                :utteranceId utterance-id
                                :currentUtteranceId (:utteranceId @state)})
                 (state-output state)]))

(defn- emoji-regex []
  (js/RegExp.
   "[\\uD83C-\\uDBFF][\\uDC00-\\uDFFF]|[\\u2600-\\u27BF]"
   "g"))

(defn parse-tokens [text]
  (let [text (or text "")
        matcher (emoji-regex)
        emojis (atom [])
        offset (atom 0)]
    (loop [match (.exec matcher text)]
      (when match
        (let [emoji (aget match 0)
              raw-index (.-index match)]
          (swap! emojis conj {:emoji emoji :index (- raw-index @offset)})
          (swap! offset + (count emoji))
          (recur (.exec matcher text)))))
    (set! (.-lastIndex matcher) 0)
    {:text (str/trim (.replace text matcher ""))
     :emojis @emojis}))

(defn- words [text]
  (remove empty? (str/split (or text "") #"\s+")))

(defn- build-word-timings [text rate]
  (let [char-ms (/ 100 (max 0.01 (number-or rate 1.0)))]
    (loop [remaining (words text)
           current-ms 0
           index 0
           timings []]
      (if (empty? remaining)
        timings
        (let [word (first remaining)
              duration-ms (+ (* (count word) char-ms) 50)]
          (recur (rest remaining)
                 (+ current-ms duration-ms)
                 (inc index)
                 (conj timings {:word word
                                :index index
                                :startSec (/ current-ms 1000)
                                :endSec (/ (+ current-ms duration-ms) 1000)})))))))

(defn- emoji-events [text emojis total-duration-ms]
  (let [text-length (max 1 (count (or text "")))]
    (mapv
     (fn [{:keys [emoji index]}]
       {:type "EMOJI"
        :emoji emoji
        :offsetMs (* total-duration-ms (/ (number-or index 0) text-length))})
     (or emojis []))))

(defn build-local-timeline [text emojis rate]
  (let [visemes (vocal/text-to-visemes text (number-or rate 1.0))
        word-items (mapv (fn [timing]
                           {:type "WORD"
                            :word (:word timing)
                            :index (:index timing)
                            :offsetMs (* (:startSec timing) 1000)})
                         (build-word-timings text rate))
        viseme-items (mapv (fn [event]
                             {:type "VISEME"
                              :visemeId (:visemeId event)
                              :offsetMs (:offsetMs event)
                              :durMs (:durationMs event)})
                           visemes)
        total-duration-ms (reduce max 0 (map #(+ (:offsetMs %) (or (:durMs %) 0)) viseme-items))]
    (vec (sort-by :offsetMs (concat word-items viseme-items (emoji-events text emojis total-duration-ms))))))

(defn- normalize-word-boundaries [boundaries]
  (mapv
   (fn [boundary]
     (let [start (number-or (or (:start_time boundary) (:startSec boundary) (:start boundary)) 0)
           end (number-or (or (:end_time boundary) (:endSec boundary) (:end boundary)) start)]
       {:word (or (:word boundary) "")
        :startSec (max 0 start)
        :endSec (max (max 0 start) end)}))
   (or boundaries [])))

(defn- timeline-word-events [word-timings]
  (map-indexed
   (fn [index timing]
     {:type "WORD"
      :word (:word timing)
      :index index
      :offsetMs (* (:startSec timing) 1000)})
   word-timings))

(defn- timeline-viseme-events [events]
  (mapv (fn [event]
          {:type "VISEME"
           :visemeId (:visemeId event)
           :offsetMs (:offsetMs event)
           :durMs (:durationMs event)})
        events))

(defn- provider-time-sec [event]
  (let [explicit-time (:time event)
        audio-offset (or (:audio_offset event) (:audioOffset event))]
    (cond
      (finite-number? explicit-time) explicit-time
      (and (finite-number? audio-offset) (> audio-offset 10000)) (/ audio-offset 10000000)
      (finite-number? audio-offset) audio-offset
      :else 0)))

(defn- infer-duration-sec [duration-sec response word-timings visemes]
  (let [provided-duration (cond
                            (and (finite-number? duration-sec) (pos? duration-sec)) duration-sec
                            (and (finite-number? (:duration response)) (pos? (:duration response))) (:duration response)
                            :else nil)
        last-word-end (reduce max 0 (map :endSec word-timings))
        last-viseme-time (reduce max 0 (map provider-time-sec visemes))
        inferred-duration (max last-word-end
                               (if (pos? last-viseme-time)
                                 (+ last-viseme-time 0.2)
                                 0))]
    (or provided-duration inferred-duration 0)))

(defn plan-text! [state text]
  (let [utterance-id (or (:utteranceId @state) (next-utterance-id))
        config (:config @state)
        parsed (parse-tokens text)
        clean-text (:text parsed)
        visemes (vocal/text-to-visemes clean-text (number-or (:rate config) 1.0))
        word-timings (mapv #(dissoc % :index) (build-word-timings clean-text (:rate config)))
        duration-sec (if (seq visemes)
                       (/ (reduce max (map #(+ (:offsetMs %) (:durationMs %)) visemes)) 1000)
                       0)
        timeline (build-local-timeline clean-text (:emojis parsed) (:rate config))
        emotion-events (filterv #(= "EMOJI" (:type %)) timeline)
        vocal-timeline {:name (str "tts_text_" utterance-id)
                        :utteranceId utterance-id
                        :text clean-text
                        :visemes visemes
                        :wordTimings word-timings
                        :durationSec duration-sec
                        :source "webSpeech"}
        plan {:utteranceId utterance-id
              :text clean-text
              :timeline timeline
              :vocalTimeline vocal-timeline
              :emotionEvents emotion-events}]
    (update-state! state #(assoc % :utteranceId utterance-id
                                   :currentText clean-text
                                   :currentTimeline timeline
                                   :error nil))
    (result plan [(timeline-output utterance-id timeline vocal-timeline emotion-events)
                  (command-output "vocal" {:type "startTimeline"
                                           :utteranceId utterance-id
                                           :timeline vocal-timeline
                                           :startOn "playbackStart"})
                  (event-output {:type "TEXT_PLANNED"
                                 :utteranceId utterance-id
                                 :text clean-text
                                 :visemeCount (count visemes)
                                 :emotionEventCount (count emotion-events)})
                  (state-output state)])))

(defn plan-azure-response! [state text response duration-sec]
  (let [utterance-id (or (:utteranceId @state) (next-utterance-id))
        config (:config @state)
        parsed (parse-tokens text)
        clean-text (:text parsed)
        response (or response {})
        word-boundaries (or (:word_boundaries response) (:wordBoundaries response) (:words response) [])
        word-timings (normalize-word-boundaries word-boundaries)
        visemes (or (:visemes response) [])
        duration-sec (infer-duration-sec duration-sec response word-timings visemes)
        total-duration-ms (.round js/Math (* (max 0 duration-sec) 1000))
        canonical-visemes (lipsync/azure-visemes-to-timeline
                           visemes
                           total-duration-ms
                           {:wordTimings word-boundaries
                            :visualLeadMs (:azureVisualLeadMs config)})
        timeline (vec (sort-by :offsetMs
                               (concat (timeline-word-events word-timings)
                                       (timeline-viseme-events
                                        (lipsync/azure-visemes-to-timeline visemes total-duration-ms {:wordTimings word-boundaries}))
                                       (emoji-events clean-text (:emojis parsed) total-duration-ms))))
        emotion-events (filterv #(= "EMOJI" (:type %)) timeline)
        vocal-timeline {:name (str "tts_azure_" utterance-id)
                        :utteranceId utterance-id
                        :text clean-text
                        :visemes canonical-visemes
                        :wordTimings word-timings
                        :durationSec duration-sec
                        :source "azure"}
        plan {:utteranceId utterance-id
              :text clean-text
              :timeline timeline
              :vocalTimeline vocal-timeline
              :emotionEvents emotion-events}]
    (update-state! state #(assoc % :utteranceId utterance-id
                                   :currentText clean-text
                                   :currentTimeline timeline
                                   :error nil))
    (result plan [(timeline-output utterance-id timeline vocal-timeline emotion-events)
                  (command-output "vocal" {:type "startTimeline"
                                           :utteranceId utterance-id
                                           :timeline vocal-timeline
                                           :startOn "playbackStart"})
                  (event-output {:type "AZURE_RESPONSE_PLANNED"
                                 :utteranceId utterance-id
                                 :text clean-text
                                 :providerVisemeCount (count visemes)
                                 :canonicalVisemeCount (count canonical-visemes)
                                 :wordCount (count word-timings)})
                  (state-output state)])))

(defn start-speech! [state text]
  (let [utterance-id (next-utterance-id)]
    (update-state! state #(assoc % :status "loading"
                                   :utteranceId utterance-id
                                   :currentText text
                                   :wordIndex 0
                                   :error nil))
    (result utterance-id [(event-output {:type "SPEECH_LOADING"
                                         :utteranceId utterance-id
                                         :text text})
                          (state-output state)])))

(defn playback-started! [state requested-utterance-id]
  (let [utterance-id (or requested-utterance-id (:utteranceId @state))]
    (if (stale-utterance? state utterance-id)
      (stale-utterance-result state "PLAYBACK_STARTED" utterance-id)
      (do
        (update-state! state #(assoc % :status "speaking" :wordIndex 0))
        (result true [(event-output {:type "PLAYBACK_STARTED"
                                     :utteranceId utterance-id})
                      (command-output "prosodic" {:type "startTalking"
                                                  :utteranceId utterance-id})
                      (state-output state)])))))

(defn process-word-boundary! [state word elapsed-sec requested-utterance-id]
  (let [utterance-id (or requested-utterance-id (:utteranceId @state))]
    (if (stale-utterance? state utterance-id)
      (stale-utterance-result state "WORD_BOUNDARY" utterance-id)
      (let [word-index (:wordIndex @state)]
        (update-state! state #(update % :wordIndex inc))
        (result true [(event-output {:type "WORD_BOUNDARY"
                                     :utteranceId utterance-id
                                     :word word
                                     :wordIndex word-index
                                     :elapsedSec elapsed-sec})
                      (command-output "vocal" {:type "onWordBoundary"
                                               :utteranceId utterance-id
                                               :word word
                                               :wordIndex word-index
                                               :observedElapsedSec elapsed-sec})
                      (command-output "prosodic" {:type "pulse"
                                                  :utteranceId utterance-id
                                                  :wordIndex word-index})
                      (state-output state)])))))

(defn finish-speech! [state requested-utterance-id]
  (let [utterance-id (or requested-utterance-id (:utteranceId @state))]
    (if (stale-utterance? state utterance-id)
      (stale-utterance-result state "SPEECH_FINISHED" utterance-id)
      (do
        (update-state! state #(assoc % :status "idle"
                                      :utteranceId nil
                                      :wordIndex 0))
        (result true [(event-output {:type "SPEECH_FINISHED"
                                     :utteranceId utterance-id})
                      (command-output "vocal" {:type "stop"
                                               :utteranceId utterance-id})
                      (command-output "prosodic" {:type "stopTalking"
                                                  :utteranceId utterance-id})
                      (state-output state)])))))

(defn stop! [state]
  (let [utterance-id (:utteranceId @state)]
    (update-state! state #(-> %
                              (assoc :status "idle"
                                     :currentText nil
                                     :currentTimeline []
                                     :utteranceId nil
                                     :wordIndex 0)
                              (update :cancelledUtteranceIds remember-cancelled utterance-id)))
    (result true [(event-output {:type "STOP"
                                 :utteranceId utterance-id})
                  (command-output "vocal" {:type "stop"
                                           :utteranceId utterance-id})
                  (command-output "prosodic" {:type "stop"
                                              :utteranceId utterance-id})
                  (state-output state)])))

(defn pause! [state]
  (update-state! state #(assoc % :status "paused"))
  (result true [(event-output {:type "PAUSE"})
                (command-output "vocal" {:type "pauseSentence"})
                (state-output state)]))

(defn resume! [state]
  (update-state! state #(assoc % :status "speaking"))
  (result true [(event-output {:type "RESUME"})
                (command-output "vocal" {:type "resumeSentence"})
                (state-output state)]))

(defn fail! [state message]
  (let [utterance-id (:utteranceId @state)]
    (update-state! state #(-> %
                              (assoc :status "error"
                                     :utteranceId nil
                                     :error (or message "TTS failed"))
                              (update :cancelledUtteranceIds remember-cancelled utterance-id)))
    (result false [(event-output {:type "ERROR"
                                  :utteranceId utterance-id
                                  :message (:error @state)})
                   (state-output state)])))

(defn update-config! [state config]
  (update-state! state #(update % :config merge (normalize-config config)))
  (result true [(event-output {:type "CONFIG_UPDATED"})
                (state-output state)]))

(defn handle-command! [state command]
  (case (:type command)
    "startSpeech" (start-speech! state (:text command))
    "planText" (plan-text! state (:text command))
    "planAzureResponse" (plan-azure-response! state (:text command) (:response command) (:durationSec command))
    "playbackStarted" (playback-started! state (:utteranceId command))
    "processWordBoundary" (process-word-boundary! state (:word command) (:elapsedSec command) (:utteranceId command))
    "finishSpeech" (finish-speech! state (:utteranceId command))
    "stop" (stop! state)
    "pause" (pause! state)
    "resume" (resume! state)
    "fail" (fail! state (:message command))
    "updateConfig" (update-config! state (:config command))
    "configure" (update-config! state (:config command))
    (result false [(protocol/emit-error agency-name (str "Unsupported TTS command: " (:type command)))])))
