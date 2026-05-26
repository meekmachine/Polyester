(ns latticework.runtime
  (:require [latticework.blink :as blink]
            [latticework.gaze :as gaze]
            [latticework.hair :as hair]
            [latticework.protocol :as protocol]))

(defn- fn-prop [value key]
  (let [candidate (and value (aget value key))]
    (when (fn? candidate) candidate)))

(defn- emit-callback! [host output]
  (when-let [on-output (fn-prop host "onOutput")]
    (on-output (protocol/data->js output))))

(defn- emit-state! [host state]
  (when-let [on-state (fn-prop host "onState")]
    (on-state (protocol/data->js state))))

(defn- schedule-cleanup! [host scheduled-name snippet]
  (when (and scheduled-name
             (not (:mixerClampWhenFinished snippet))
             (fn-prop host "removeSnippet"))
    (let [duration-ms (+ (* (or (:maxTime snippet) 0) 1000) 50)]
      (js/setTimeout
       (fn []
         (when-let [remove-snippet (fn-prop host "removeSnippet")]
           (remove-snippet scheduled-name)))
       duration-ms))))

(defn apply-output! [host output]
  (emit-callback! host output)
  (case (:type output)
    "state"
    (emit-state! host (:state output))

    "scheduleSnippet"
    (when-let [schedule-snippet (fn-prop host "scheduleSnippet")]
      (let [snippet (:snippet output)
            options (:options output)
            scheduled-name (schedule-snippet
                            (protocol/data->js snippet)
                            (protocol/data->js options))]
        (schedule-cleanup! host scheduled-name snippet)))

    "removeSnippet"
    (when-let [remove-snippet (fn-prop host "removeSnippet")]
      (remove-snippet (:name output)))

    "applyHairState"
    (if-let [apply-hair-state (fn-prop host "applyHairState")]
      (apply-hair-state
       (protocol/data->js (:state output))
       (protocol/data->js (:objects output))
       (protocol/data->js (:objectStates output)))
      (when-let [apply-object-state (fn-prop host "applyHairStateToObject")]
        (doseq [{:keys [name objectState]} (:objectStates output)]
          (apply-object-state name (protocol/data->js objectState)))))

    "applyHairPhysics"
    (if-let [apply-hair-physics (fn-prop host "applyHairPhysics")]
      (apply-hair-physics
       (:enabled output)
       (protocol/data->js (:config output)))
      (do
        (when-let [set-physics-config (fn-prop host "setHairPhysicsConfig")]
          (set-physics-config (protocol/data->js (:config output))))
        (when-let [set-physics-enabled (fn-prop host "setHairPhysicsEnabled")]
          (set-physics-enabled (:enabled output)))))

    "error"
    (if-let [on-error (fn-prop host "onError")]
      (on-error (protocol/data->js output))
      (.warn js/console (:message output)))

    nil))

(defn apply-outputs! [host outputs]
  (doseq [output outputs]
    (apply-output! host output)))

(defn create-in-process-blink-agency
  ([config] (create-in-process-blink-agency config nil))
  ([config host]
   (let [state (blink/create-state (protocol/js->data config))
         host (or host #js {})
         auto-timer (atom nil)
         disposed (atom false)
         clear-auto! (fn []
                       (when-let [timer @auto-timer]
                         (js/clearTimeout timer)
                         (reset! auto-timer nil)))]
     (letfn [(emit! [outputs]
               (when-not @disposed
                 (apply-outputs! host outputs)))
             (schedule-next-auto! []
               (clear-auto!)
               (when (and (not @disposed) (:enabled @state))
                 (when-let [interval (blink/auto-interval-ms (blink/snapshot state))]
                   (reset! auto-timer
                           (js/setTimeout
                            (fn []
                              (reset! auto-timer nil)
                              (when (and (not @disposed) (:enabled @state))
                                (emit! (blink/trigger-blink! state nil))
                                (schedule-next-auto!)))
                            interval)))))
             (sync-auto! []
               (if (and (not @disposed) (:enabled @state))
                 (schedule-next-auto!)
                 (clear-auto!)))]
       (emit! [(protocol/emit-state blink/agency-name (blink/snapshot state))])
       (sync-auto!)
       #js {:configure (fn [next-config]
                         (emit! (blink/configure! state (protocol/js->data next-config)))
                         (sync-auto!))
            :enable (fn []
                      (emit! (blink/enable! state))
                      (sync-auto!))
            :disable (fn []
                       (emit! (blink/disable! state))
                       (sync-auto!))
            :setFrequency (fn [frequency]
                            (emit! (blink/set-frequency! state frequency))
                            (sync-auto!))
            :setDuration (fn [duration]
                           (emit! (blink/set-duration! state duration)))
            :setIntensity (fn [intensity]
                            (emit! (blink/set-intensity! state intensity)))
            :setRandomness (fn [randomness]
                             (emit! (blink/set-randomness! state randomness))
                             (sync-auto!))
            :triggerBlink (fn
                            ([] (emit! (blink/trigger-blink! state nil)))
                            ([overrides] (emit! (blink/trigger-blink! state (protocol/js->data overrides)))))
            :reset (fn []
                     (emit! (blink/reset-state! state))
                     (sync-auto!))
            :getState (fn []
                        (protocol/data->js (blink/snapshot state)))
            :dispose (fn []
                       (reset! disposed true)
                       (clear-auto!))}))))

(defn create-in-process-gaze-agency
  ([config] (create-in-process-gaze-agency config nil))
  ([config host]
   (let [state (gaze/create-state (protocol/js->data config))
         host (or host #js {})
         disposed (atom false)]
     (letfn [(emit! [outputs]
               (when-not @disposed
                 (apply-outputs! host outputs))
               outputs)
             (schedule! [target]
               (let [outputs (emit! (gaze/schedule-target! state (protocol/js->data target)))]
                 (boolean (some #(= "scheduleSnippet" (:type %)) outputs))))]
       (emit! [(protocol/emit-state gaze/agency-name (gaze/snapshot state))])
       #js {:configure (fn [next-config]
                         (emit! (gaze/configure! state (protocol/js->data next-config))))
            :updateConfig (fn [next-config]
                            (emit! (gaze/configure! state (protocol/js->data next-config))))
            :setMode (fn [mode]
                       (emit! (gaze/set-mode! state mode)))
            :setTarget (fn [target]
                         (schedule! target))
            :schedule (fn [target]
                        (schedule! target))
            :resetToNeutral (fn
                              ([] (emit! (gaze/reset-to-neutral! state nil)))
                              ([duration] (emit! (gaze/reset-to-neutral! state duration))))
            :stop (fn []
                    (emit! (gaze/stop! state)))
            :getState (fn []
                        (protocol/data->js (gaze/snapshot state)))
            :dispose (fn []
                       (emit! (gaze/stop! state))
                       (reset! disposed true))}))))

(defn create-in-process-hair-agency
  ([config] (create-in-process-hair-agency config nil))
  ([config host]
   (let [state (hair/create-state (protocol/js->data config))
         host (or host #js {})
         disposed (atom false)]
     (letfn [(emit! [outputs]
               (when-not @disposed
                 (apply-outputs! host outputs))
               outputs)]
       (emit! [(protocol/emit-state hair/agency-name (hair/snapshot state))])
       #js {:configure (fn [next-config]
                         (emit! (hair/configure! state (protocol/js->data next-config))))
            :registerObjects (fn [objects]
                               (emit! (hair/register-objects! state (protocol/js->data objects))))
            :send (fn [event]
                    (emit! (hair/handle-command!
                            state
                            {:type "send" :event (protocol/js->data event)})))
            :setHairColor (fn [color]
                            (emit! (hair/set-hair-color! state (protocol/js->data color))))
            :setEyebrowColor (fn [color]
                               (emit! (hair/set-eyebrow-color! state (protocol/js->data color))))
            :setHairBaseColor (fn [base-color]
                                (emit! (hair/set-hair-base-color! state base-color)))
            :setEyebrowBaseColor (fn [base-color]
                                   (emit! (hair/set-eyebrow-base-color! state base-color)))
            :setHairGlow (fn [emissive intensity]
                           (emit! (hair/set-hair-glow! state emissive intensity)))
            :setEyebrowGlow (fn [emissive intensity]
                              (emit! (hair/set-eyebrow-glow! state emissive intensity)))
            :setOutline (fn
                          ([show] (emit! (hair/set-outline! state show nil nil)))
                          ([show color] (emit! (hair/set-outline! state show color nil)))
                          ([show color opacity] (emit! (hair/set-outline! state show color opacity))))
            :setPartVisibility (fn [part-name visible]
                                  (emit! (hair/set-part-visibility! state part-name visible)))
            :setPartScale (fn [part-name scale]
                            (emit! (hair/set-part-scale! state part-name scale)))
            :setPartPosition (fn [part-name position]
                               (emit! (hair/set-part-position! state part-name (protocol/js->data position))))
            :resetToDefault (fn []
                              (emit! (hair/reset-to-default! state)))
            :setPhysicsEnabled (fn [enabled]
                                  (emit! (hair/set-physics-enabled! state enabled)))
            :updatePhysicsConfig (fn [config]
                                   (emit! (hair/update-physics-config! state (protocol/js->data config))))
            :getState (fn []
                        (protocol/data->js (hair/snapshot state)))
            :getHairState (fn []
                            (protocol/data->js (hair/hair-snapshot state)))
            :getPhysicsConfig (fn []
                                (protocol/data->js
                                 (assoc (get-in (hair/snapshot state) [:physics :config])
                                        :enabled (get-in (hair/snapshot state) [:physics :enabled]))))
            :dispose (fn []
                       (reset! disposed true))}))))

(defn create-worker-client [worker host]
  (let [host (or host #js {})
        disposed (atom false)
        handler (fn [event]
                  (when-not @disposed
                    (apply-output! host (protocol/js->data (.-data event)))))]
    (.addEventListener worker "message" handler)
    #js {:post (fn [command]
                 (when-not @disposed
                   (.postMessage worker command)))
         :configure (fn [agency config]
                      (when-not @disposed
                        (.postMessage worker #js {:agency agency
                                                  :type "configure"
                                                  :config config})))
         :dispose (fn []
                    (reset! disposed true)
                    (.removeEventListener worker "message" handler))}))

(defn create-blink-worker-client [worker host]
  (let [client (create-worker-client worker host)]
    #js {:configure (fn [config]
                      (.configure client blink/agency-name config))
         :enable (fn []
                   (.post client #js {:agency "blink" :type "enable"}))
         :disable (fn []
                    (.post client #js {:agency "blink" :type "disable"}))
         :setFrequency (fn [frequency]
                         (.post client #js {:agency "blink" :type "setFrequency" :frequency frequency}))
         :setDuration (fn [duration]
                        (.post client #js {:agency "blink" :type "setDuration" :duration duration}))
         :setIntensity (fn [intensity]
                         (.post client #js {:agency "blink" :type "setIntensity" :intensity intensity}))
         :setRandomness (fn [randomness]
                          (.post client #js {:agency "blink" :type "setRandomness" :randomness randomness}))
         :triggerBlink (fn
                         ([] (.post client #js {:agency "blink" :type "triggerBlink"}))
                         ([overrides]
                          (let [command (js/Object.assign #js {:agency "blink" :type "triggerBlink"} overrides)]
                            (.post client command))))
         :reset (fn []
                  (.post client #js {:agency "blink" :type "reset"}))
         :dispose (fn []
                    (.dispose client))}))

(defn create-hair-worker-client [worker host]
  (let [client (create-worker-client worker host)]
    #js {:configure (fn [config]
                      (.configure client hair/agency-name config))
         :registerObjects (fn [objects]
                            (.post client #js {:agency "hair" :type "registerObjects" :objects objects}))
         :send (fn [event]
                 (.post client #js {:agency "hair" :type "send" :event event}))
         :setHairColor (fn [color]
                         (.post client #js {:agency "hair" :type "setHairColor" :color color}))
         :setEyebrowColor (fn [color]
                            (.post client #js {:agency "hair" :type "setEyebrowColor" :color color}))
         :setHairBaseColor (fn [base-color]
                             (.post client #js {:agency "hair" :type "setHairBaseColor" :baseColor base-color}))
         :setEyebrowBaseColor (fn [base-color]
                                (.post client #js {:agency "hair" :type "setEyebrowBaseColor" :baseColor base-color}))
         :setHairGlow (fn [emissive intensity]
                        (.post client #js {:agency "hair" :type "setHairGlow" :emissive emissive :intensity intensity}))
         :setEyebrowGlow (fn [emissive intensity]
                           (.post client #js {:agency "hair" :type "setEyebrowGlow" :emissive emissive :intensity intensity}))
         :setOutline (fn
                       ([show] (.post client #js {:agency "hair" :type "setOutline" :show show}))
                       ([show color] (.post client #js {:agency "hair" :type "setOutline" :show show :color color}))
                       ([show color opacity]
                        (.post client #js {:agency "hair" :type "setOutline" :show show :color color :opacity opacity})))
         :setPartVisibility (fn [part-name visible]
                              (.post client #js {:agency "hair" :type "setPartVisibility" :partName part-name :visible visible}))
         :setPartScale (fn [part-name scale]
                         (.post client #js {:agency "hair" :type "setPartScale" :partName part-name :scale scale}))
         :setPartPosition (fn [part-name position]
                            (.post client #js {:agency "hair" :type "setPartPosition" :partName part-name :position position}))
         :resetToDefault (fn []
                           (.post client #js {:agency "hair" :type "resetToDefault"}))
         :setPhysicsEnabled (fn [enabled]
                              (.post client #js {:agency "hair" :type "setPhysicsEnabled" :enabled enabled}))
         :updatePhysicsConfig (fn [config]
                                (.post client #js {:agency "hair" :type "updatePhysicsConfig" :config config}))
         :dispose (fn []
                    (.dispose client))}))

(defn create-gaze-worker-client [worker host]
  (let [client (create-worker-client worker host)]
    #js {:configure (fn [config]
                      (.configure client gaze/agency-name config))
         :updateConfig (fn [config]
                         (.configure client gaze/agency-name config))
         :setMode (fn [mode]
                    (.post client #js {:agency "gaze" :type "setMode" :mode mode}))
         :setTarget (fn [target]
                      (.post client #js {:agency "gaze" :type "setTarget" :target target}))
         :schedule (fn [target]
                     (.post client #js {:agency "gaze" :type "schedule" :target target}))
         :resetToNeutral (fn
                           ([] (.post client #js {:agency "gaze" :type "resetToNeutral"}))
                           ([duration] (.post client #js {:agency "gaze" :type "resetToNeutral" :duration duration})))
         :stop (fn []
                 (.post client #js {:agency "gaze" :type "stop"}))
         :dispose (fn []
                    (.dispose client))}))
