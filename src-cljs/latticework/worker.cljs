(ns latticework.worker
  (:require [latticework.blink :as blink]
            [latticework.protocol :as protocol]))

(defonce blink-state (blink/create-state))

(defn- post-output! [output]
  (.postMessage js/self (protocol/data->js output)))

(defn- post-outputs! [outputs]
  (doseq [output outputs]
    (post-output! output)))

(defn- dispatch! [command]
  (case (:agency command)
    "blink" (blink/handle-command! blink-state command)
    [(protocol/emit-error
      (or (:agency command) "unknown")
      (str "Unsupported agency: " (:agency command)))]))

(defn- handle-message! [event]
  (let [command (protocol/js->data (.-data event))]
    (post-outputs! (dispatch! command))))

(defn init []
  (.addEventListener js/self "message" handle-message!)
  (post-output! (protocol/emit-state blink/agency-name (blink/snapshot blink-state))))
