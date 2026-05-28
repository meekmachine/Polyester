(ns latticework.transcription
  (:require [clojure.string :as str]
            [latticework.protocol :as protocol]))

(def agency-name "transcription")

(def default-config
  {:language "en-US"
   :continuous true
   :interimResults true
   :echoSuppression true
   :interruptionThreshold 0.12
   :referenceRatio 1.8
   :releaseThreshold 0.06
   :releaseMs 350
   :autoRestart true
   :restartDelayMs 250
   :maxRestartCount 3})

(def default-state
  {:status "idle"
   :isListening false
   :interimTranscript ""
   :finalTranscript ""
   :lastTranscript ""
   :lastConfidence nil
   :isInterrupted false
   :interruptionSource nil
   :lastUserLevel 0
   :lastReferenceLevel 0
   :lastInterruptionTime nil
   :error nil
   :restartCount 0
   :lastRestartReason nil
   :pendingRestart nil
   :lastRecommendation nil
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

(defn transcription-state [state]
  (select-keys @state [:status
                       :isListening
                       :interimTranscript
                       :finalTranscript
                       :isInterrupted
                       :interruptionSource
                       :error
                       :restartCount
                       :pendingRestart
                       :lastRecommendation]))

(defn- state-output [state]
  (protocol/emit-state agency-name @state))

(defn- event-output [event]
  {:type "transcriptionEvent"
   :agency agency-name
   :event (assoc event :timestamp (now))})

(defn- command-output [target command]
  {:type "agencyCommand"
   :agency agency-name
   :target target
   :command command})

(defn- recommendation-output [recommendation]
  {:type "transcriptionRecommendation"
   :agency agency-name
   :recommendation recommendation})

(defn- result [value outputs]
  {:result value :outputs (vec (remove nil? outputs))})

(defn- update-state! [state update-fn]
  (swap! state
         (fn [current]
           (-> current
               update-fn
               (update :eventCount inc)
               (assoc :lastUpdatedTime (now))))))

(defn- remember-recommendation! [state recommendation]
  (swap! state assoc :lastRecommendation recommendation)
  recommendation)

(defn- cleanup-recommendation! [state reason extra]
  (let [recommendation (remember-recommendation!
                        state
                        (merge {:type "CLEANUP"
                                :reason reason
                                :clearInterimTranscript true
                                :clearInterruption true
                                :cancelRestart true}
                               extra))]
    (recommendation-output recommendation)))

(defn- restart-recommendation! [state reason]
  (let [config (:config @state)
        max-restarts (max 0 (number-or (:maxRestartCount config) 3))
        next-count (inc (:restartCount @state))
        can-restart? (and (:continuous config)
                          (:autoRestart config)
                          (<= next-count max-restarts))
        recommendation (if can-restart?
                         {:type "RESTART"
                          :reason reason
                          :delayMs (max 0 (number-or (:restartDelayMs config) 250))
                          :restartCount next-count
                          :maxRestartCount max-restarts}
                         {:type "STOP"
                          :reason (if (and (:continuous config) (:autoRestart config))
                                    "maxRestartCount"
                                    reason)
                          :restartCount (:restartCount @state)
                          :maxRestartCount max-restarts})]
    (update-state!
     state
     #(assoc % :restartCount (if can-restart? next-count (:restartCount %))
               :lastRestartReason reason
               :pendingRestart (when (= "RESTART" (:type recommendation)) recommendation)
               :lastRecommendation recommendation))
    (recommendation-output recommendation)))

(defn normalize-transcript [transcript]
  (-> (or transcript "")
      str/trim
      (str/replace #"\s+" " ")))

(defn- echo? [state transcript]
  (let [config (:config @state)
        user-level (:lastUserLevel @state)
        reference-level (:lastReferenceLevel @state)
        ratio (number-or (:referenceRatio config) 1.8)]
    (and (:echoSuppression config)
         (seq transcript)
         (> reference-level 0)
         (< user-level (* reference-level ratio)))))

(defn start! [state]
  (update-state! state #(assoc % :status "listening"
                                :isListening true
                                :interimTranscript ""
                                :finalTranscript ""
                                :error nil
                                :pendingRestart nil))
  (result true [(event-output {:type "START"})
                (state-output state)]))

(defn stop! [state]
  (update-state! state #(assoc % :status "idle"
                                :isListening false
                                :isInterrupted false
                                :interruptionSource nil
                                :pendingRestart nil))
  (result true [(event-output {:type "STOP"})
                (cleanup-recommendation! state "stop" {:releaseBrowserResources true})
                (state-output state)]))

(defn reset-state! [state]
  (update-state! state #(assoc % :interimTranscript ""
                                :finalTranscript ""
                                :lastTranscript ""
                                :lastConfidence nil
                                :isInterrupted false
                                :interruptionSource nil
                                :error nil
                                :restartCount 0
                                :lastRestartReason nil
                                :pendingRestart nil))
  (result true [(event-output {:type "RESET"})
                (cleanup-recommendation! state "reset" {:releaseBrowserResources false})
                (state-output state)]))

(defn process-result! [state transcript final? confidence source]
  (let [transcript (normalize-transcript transcript)
        confidence (when (finite-number? confidence) confidence)
        filtered? (echo? state transcript)]
    (if filtered?
      (result false [(event-output {:type "TRANSCRIPT_FILTERED"
                                    :transcript transcript
                                    :source (or source "speechRecognition")})
                     (state-output state)])
      (do
        (update-state!
         state
         #(-> %
              (assoc :lastTranscript transcript
                     :lastConfidence confidence)
              (cond->
                final? (assoc :finalTranscript transcript
                              :interimTranscript "")
                (not final?) (assoc :interimTranscript transcript))))
        (result true [(event-output {:type (if final? "TRANSCRIPT_FINAL" "TRANSCRIPT_INTERIM")
                                      :transcript transcript
                                      :confidence confidence
                                      :source (or source "speechRecognition")
                                      :interrupted (:isInterrupted @state)})
                      (when (and final? (:isInterrupted @state))
                        (command-output "conversation" {:type "userSpeech"
                                                        :text transcript
                                                        :isFinal true
                                                        :interrupted true}))
                      (state-output state)])))))

(defn process-audio-level! [state user-level reference-level timestamp]
  (let [config (:config @state)
        timestamp (number-or timestamp (protocol/now-ms))
        user-level (max 0 (number-or user-level 0))
        reference-level (max 0 (number-or reference-level 0))
        threshold (number-or (:interruptionThreshold config) 0.12)
        release-threshold (number-or (:releaseThreshold config) 0.06)
        ratio (number-or (:referenceRatio config) 1.8)
        release-ms (number-or (:releaseMs config) 350)
        interrupted? (:isInterrupted @state)
        should-interrupt? (and (:isListening @state)
                               (>= user-level threshold)
                               (or (zero? reference-level)
                                   (>= user-level (* reference-level ratio))))
        should-release? (and interrupted?
                             (< user-level release-threshold)
                             (:lastInterruptionTime @state)
                             (>= (- timestamp (:lastInterruptionTime @state)) release-ms))]
    (update-state! state #(assoc % :lastUserLevel user-level :lastReferenceLevel reference-level))
    (cond
      should-interrupt?
      (do
        (update-state! state #(assoc % :isInterrupted true
                                      :interruptionSource "audio"
                                      :lastInterruptionTime timestamp))
        (result true [(event-output {:type "INTERRUPTION_DETECTED"
                                      :source "audio"
                                      :userLevel user-level
                                      :referenceLevel reference-level})
                      (command-output "conversation" {:type "interrupt" :source "audio"})
                      (state-output state)]))

      should-release?
      (do
        (update-state! state #(assoc % :isInterrupted false :interruptionSource nil))
        (result true [(event-output {:type "INTERRUPTION_RELEASED"
                                      :source "audio"})
                      (state-output state)]))

      :else
      (result false [(state-output state)]))))

(defn fail! [state message]
  (update-state! state #(assoc % :status "error"
                                :isListening false
                                :error (or message "Transcription failed")
                                :isInterrupted false
                                :interruptionSource nil))
  (result false [(event-output {:type "ERROR" :message (:error @state)})
                 (restart-recommendation! state "error")
                 (state-output state)]))

(defn update-config! [state config]
  (update-state! state #(update % :config merge (normalize-config config)))
  (result true [(event-output {:type "CONFIG_UPDATED"})
                (state-output state)]))

(defn handle-command! [state command]
  (case (:type command)
    "start" (start! state)
    "stop" (stop! state)
    "reset" (reset-state! state)
    "processResult" (process-result! state (:transcript command) (:isFinal command) (:confidence command) (:source command))
    "processAudioLevel" (process-audio-level! state (:userLevel command) (:referenceLevel command) (:timestamp command))
    "fail" (fail! state (:message command))
    "updateConfig" (update-config! state (:config command))
    "configure" (update-config! state (:config command))
    (result false [(protocol/emit-error agency-name (str "Unsupported transcription command: " (:type command)))])))
