(ns latticework.npm
  (:require [latticework.runtime :as runtime]))

(defn create-blink-agency
  ([config] (runtime/create-in-process-blink-agency config nil))
  ([config host] (runtime/create-in-process-blink-agency config host)))

(defn create-agency-worker-client [worker host]
  (runtime/create-worker-client worker host))

(defn create-blink-worker-client [worker host]
  (runtime/create-blink-worker-client worker host))

(defn install-latticework
  ([] (install-latticework js/globalThis))
  ([target]
   (let [api #js {:createBlinkAgency create-blink-agency
                  :createAgencyWorkerClient create-agency-worker-client
                  :createBlinkWorkerClient create-blink-worker-client}]
     (aset target "Latticework" api)
     api)))
