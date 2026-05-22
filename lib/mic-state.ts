"use client"

export type MicUser = "chat" | "agent" | null

let activeMic: MicUser = null
const listeners: Array<(user: MicUser) => void> = []

export const micState = {
  get active(): MicUser {
    return activeMic
  },
  acquire(user: MicUser): boolean {
    if (activeMic !== null && activeMic !== user) return false
    activeMic = user
    notify()
    return true
  },
  release(user: MicUser) {
    if (activeMic === user) {
      activeMic = null
      notify()
    }
  },
  onChange(cb: (user: MicUser) => void) {
    listeners.push(cb)
    return () => {
      const i = listeners.indexOf(cb)
      if (i >= 0) listeners.splice(i, 1)
    }
  },
}

function notify() {
  for (const cb of listeners) cb(activeMic)
}
