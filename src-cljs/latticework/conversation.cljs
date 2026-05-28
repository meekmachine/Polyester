(ns latticework.conversation
  (:require [clojure.string :as str]
            [latticework.protocol :as protocol]))

(def agency-name "conversation")

(def default-config
  {:autoListen true
   :useGaze true
   :useProsody true
   :useBlink true
   :interruptionEnabled true})

(def default-state
  {:state "idle"
   :turnId 0
   :isRunning false
   :lastAgentText nil
   :lastUserText nil
   :pendingTranscript nil
   :interrupted false
   :interruptionSource nil
   :config default-config
   :eventCount 0
   :lastUpdatedTime nil})

(defn- now []
  (.round js/Math (protocol/now-ms)))

(defn- normalize-config [config]
  (merge default-config (select-keys (or config {}) (keys default-config))))

(defn create-state
  ([] (create-state nil))
  ([config]
   (atom (assoc default-state :config (normalize-config config)))))

(defn snapshot [state]
  @state)

(defn conversation-state [state]
  (select-keys @state [:state :turnId :isRunning :lastAgentText :lastUserText :pendingTranscript :interrupted :interruptionSource]))

(defn- state-output [state]
  (protocol/emit-state agency-name @state))

(defn- event-output [event]
  {:type "conversationEvent"
   :agency agency-name
   :event (assoc event :timestamp (now))})

(defn- command-output [target command]
  {:type "agencyCommand"
   :agency agency-name
   :target target
   :command command})

(defn- config-enabled? [state key]
  (boolean (get-in @state [:config key])))

(defn- command-when [enabled target command]
  (when enabled
    (command-output target command)))

(defn- mouth-stop-outputs [reason]
  [(command-output "vocal" {:type "stop" :reason reason})
   (command-output "lipsync" {:type "stop" :reason reason})])

(defn- speaking-stop-outputs [state reason]
  (vec (concat
        [(command-output "tts" {:type "stop" :reason reason})]
        (mouth-stop-outputs reason)
        [(command-when (config-enabled? state :useProsody)
                       "prosodic"
                       {:type "stop" :reason reason})])))

(defn- result [value outputs]
  {:result value :outputs (vec (remove nil? outputs))})

(defn- update-state! [state update-fn]
  (swap! state
         (fn [current]
           (-> current
               update-fn
               (update :eventCount inc)
               (assoc :lastUpdatedTime (now))))))

(defn- set-conversation-state! [state next-state]
  (update-state! state #(assoc % :state next-state)))

(defn start! [state]
  (update-state! state #(assoc % :state "idle"
                                :isRunning true
                                :interrupted false
                                :interruptionSource nil))
  (result true [(event-output {:type "START"})
                (command-when (:autoListen (:config @state)) "transcription" {:type "start"})
                (command-when (config-enabled? state :useBlink) "blink" {:type "enable"})
                (state-output state)]))

(defn stop! [state]
  (update-state! state #(assoc % :state "idle"
                                :isRunning false
                                :pendingTranscript nil
                                :interrupted false
                                :interruptionSource nil))
  (result true [(event-output {:type "STOP"})
                (command-output "tts" {:type "stop" :reason "conversationStop"})
                (command-output "vocal" {:type "stop" :reason "conversationStop"})
                (command-output "lipsync" {:type "stop" :reason "conversationStop"})
                (command-when (config-enabled? state :useProsody)
                              "prosodic"
                              {:type "stop" :reason "conversationStop"})
                (command-output "transcription" {:type "stop"})
                (command-when (config-enabled? state :useBlink) "blink" {:type "disable"})
                (state-output state)]))

(defn agent-start! [state text]
  (let [text (str/trim (or text ""))]
    (update-state!
     state
     #(-> %
          (assoc :state "agentSpeaking"
                 :lastAgentText text
                 :pendingTranscript nil
                 :interrupted false
                 :interruptionSource nil)
          (update :turnId inc)))
    (result true [(event-output {:type "AGENT_SPEAKING"
                                  :turnId (:turnId @state)
                                  :text text})
                  (command-output "tts" {:type "startSpeech" :text text})
                  (command-output "tts" {:type "planText" :text text})
                  (command-when (config-enabled? state :useProsody)
                                "prosodic"
                                {:type "startTalking"})
                  (command-when (config-enabled? state :useGaze)
                                "gaze"
                                {:type "setTarget" :target {:x 0 :y 0 :z 0}})
                  (state-output state)])))

(defn agent-end! [state]
  (set-conversation-state! state "idle")
  (result true [(event-output {:type "AGENT_FINISHED" :turnId (:turnId @state)})
                (command-when (config-enabled? state :useProsody)
                              "prosodic"
                              {:type "stopTalking"})
                (command-output "vocal" {:type "stop" :reason "agentEnd"})
                (command-output "lipsync" {:type "stop" :reason "agentEnd"})
                (when (:autoListen (:config @state))
                  (command-output "transcription" {:type "start"}))
                (state-output state)]))

(defn user-speech! [state text final? interrupted?]
  (let [text (str/trim (or text ""))]
    (update-state!
     state
     #(assoc % :lastUserText text
               :pendingTranscript (when-not final? text)
               :state (if final? "processing" "userSpeaking")))
    (result true [(event-output {:type (if final? "USER_FINAL" "USER_INTERIM")
                                  :text text
                                  :interrupted (boolean interrupted?)})
                  (when final?
                    (command-output "transcription" {:type "stop"}))
                  (when (and final? (config-enabled? state :useGaze))
                    (command-output "gaze" {:type "setTarget" :target {:x -0.2 :y -0.15 :z 0}}))
                  (state-output state)])))

(defn processing-complete! [state]
  (set-conversation-state! state "idle")
  (result true [(event-output {:type "PROCESSING_COMPLETE"})
                (when (:autoListen (:config @state))
                  (command-output "transcription" {:type "start"}))
                (state-output state)]))

(defn interrupt! [state source]
  (let [source (or source "unknown")]
    (if-not (:interruptionEnabled (:config @state))
      (result false [(event-output {:type "INTERRUPTION_IGNORED" :source source})
                     (state-output state)])
      (do
        (update-state!
         state
         #(assoc % :state "interrupted"
                   :interrupted true
                   :interruptionSource source))
        (result true (concat [(event-output {:type "INTERRUPTED"
                                             :turnId (:turnId @state)
                                             :source source})]
                             (speaking-stop-outputs state "interruption")
                             [(command-when (config-enabled? state :useGaze)
                                            "gaze"
                                            {:type "resetToNeutral" :duration 120})
                              (state-output state)]))))))

(defn update-config! [state config]
  (update-state! state #(update % :config merge (normalize-config config)))
  (result true [(event-output {:type "CONFIG_UPDATED"})
                (state-output state)]))

(defn handle-command! [state command]
  (case (:type command)
    "start" (start! state)
    "stop" (stop! state)
    "agentStart" (agent-start! state (:text command))
    "agentEnd" (agent-end! state)
    "userSpeech" (user-speech! state (:text command) (:isFinal command) (:interrupted command))
    "processingComplete" (processing-complete! state)
    "interrupt" (interrupt! state (:source command))
    "updateConfig" (update-config! state (:config command))
    "configure" (update-config! state (:config command))
    (result false [(protocol/emit-error agency-name (str "Unsupported conversation command: " (:type command)))])))
