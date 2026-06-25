import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

function getServerSnapshot() {
  return false
}

function subscribe(callback: () => void) {
  const mediaQueryList = window.matchMedia(MOBILE_MEDIA_QUERY)

  mediaQueryList.addEventListener("change", callback)

  return () => {
    mediaQueryList.removeEventListener("change", callback)
  }
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
