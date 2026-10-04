<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue';

import { useSyncStore } from '@/stores/sync';

/**
 * The Google sign-in as a pill in the Heute header – "Anmelden" while signed
 * out, "Sync" with a tick once connected. Tapping the connected pill opens a
 * small panel with the account, the status line and "Abmelden". Renders nothing
 * unless the build has a Google client id.
 */

const sync = useSyncStore();

const root = useTemplateRef<HTMLElement>('root');
const open = ref(false);

function closeOutside(event: PointerEvent): void {
  if (!root.value?.contains(event.target as Node)) open.value = false;
}

watch(open, (value) => {
  if (value) document.addEventListener('pointerdown', closeOutside);
  else document.removeEventListener('pointerdown', closeOutside);
});
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOutside));

// The first-connection question needs an answer before anything syncs, so the
// panel opens by itself instead of waiting for a tap on the pill.
watch(
  () => sync.status,
  (status) => {
    if (status === 'ask') open.value = true;
  },
  { immediate: true },
);

/** Anything that needs the user's attention turns the pill red. */
const alert = computed(() =>
  ['expired', 'offline', 'error', 'ask'].includes(sync.status),
);

const statusLine = computed(() => {
  switch (sync.status) {
    case 'connecting':
      return 'Anmeldung läuft …';
    case 'syncing':
      return 'Wird abgeglichen …';
    case 'offline':
      return 'Keine Verbindung – Änderungen werden nachgeholt.';
    case 'expired':
      return 'Anmeldung abgelaufen – der Abgleich ruht.';
    case 'ask':
      return 'Erste Verbindung dieses Geräts.';
    default:
      return sync.lastSyncedAt
        ? `Zuletzt abgeglichen: ${new Date(sync.lastSyncedAt).toLocaleString('de-DE', {
            dateStyle: 'short',
            timeStyle: 'short',
          })}`
        : '';
  }
});

function signOut(): void {
  sync.signOut();
  open.value = false;
}
</script>

<template>
  <div v-if="sync.enabled" ref="root" class="sync">
    <button
      v-if="!sync.email"
      class="sync__pill"
      type="button"
      :aria-disabled="sync.status === 'connecting'"
      @click="sync.status !== 'connecting' && sync.signIn()"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M17.5 19H7a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 11a4 4 0 0 1-1.5 8z" />
      </svg>
      {{ sync.status === 'connecting' ? 'Anmeldung …' : 'Anmelden' }}
    </button>

    <button
      v-else
      class="sync__pill"
      :class="{ 'sync__pill--alert': alert }"
      type="button"
      :aria-expanded="open"
      :title="`Angemeldet als ${sync.email}`"
      @click="open = !open"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M17.5 19H7a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 11a4 4 0 0 1-1.5 8z" />
        <path v-if="alert" d="M12 11v3M12 16.5v.01" />
        <path v-else d="M9 14l2 2 4-4" />
      </svg>
      Sync
    </button>

    <div v-if="open && sync.email" class="sync__panel">
      <p>
        Angemeldet als <span class="sync__email">{{ sync.email }}</span>
      </p>
      <p v-if="statusLine" class="sync__note">{{ statusLine }}</p>
      <p class="sync__note">Abgeglichen werden Plan, Sitzungen und Ränge.</p>

      <div v-if="sync.status === 'ask'" class="sync__confirm">
        <p>
          In deinem Google Drive liegt schon ein Stand. Welcher soll ab jetzt auf allen
          Geräten gelten?
        </p>
        <p class="sync__actions">
          <button
            class="sync__action sync__action--danger"
            type="button"
            @click="sync.chooseRemote()"
          >
            Drive-Stand übernehmen
          </button>
          <span class="sync__dot">·</span>
          <button class="sync__action" type="button" @click="sync.chooseLocal()">
            Dieses Gerät hochladen
          </button>
        </p>
      </div>

      <p class="sync__actions">
        <template v-if="sync.status === 'expired'">
          <button class="sync__action" type="button" @click="sync.signIn()">
            Fortsetzen
          </button>
          <span class="sync__dot">·</span>
        </template>
        <button class="sync__action" type="button" @click="signOut">Abmelden</button>
      </p>
    </div>

    <p v-if="sync.error" class="sync__error">{{ sync.error }}</p>
  </div>
</template>

<style scoped>
.sync {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex: none;
}

.sync__pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 11px;
  background: var(--vh-800);
  border: 1px solid var(--vh-600);
  border-radius: 999px;
  font: 500 11px/1 var(--vh-mono);
  color: var(--vh-200);
  transition:
    color var(--vh-t-color),
    border-color var(--vh-t-color);
}

.sync__pill:hover {
  color: var(--vh-050);
}

.sync__pill--alert {
  color: var(--vh-danger-strong);
  border-color: var(--vh-danger);
}

.sync__pill--alert:hover {
  color: var(--vh-danger-strong);
}

.sync__panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 7px;
  width: 250px;
  padding: 12px 14px;
  background: var(--vh-800);
  border: 1px solid var(--vh-600);
  border-radius: var(--vh-r-panel);
  font: 400 12px/1.45 var(--vh-sans);
  color: var(--vh-200);
}

.sync__panel p {
  margin: 0;
}

.sync__email {
  font: 400 11px/1.3 var(--vh-mono);
  color: var(--vh-050);
  word-break: break-all;
}

.sync__note {
  font: 400 11px/1.5 var(--vh-mono);
  color: var(--vh-400);
}

.sync__confirm {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 10px 11px;
  border: 1px solid var(--vh-600);
  border-radius: var(--vh-r-tile);
  background: var(--vh-900);
}

.sync__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
}

/* A link in everything but the element – it acts, so it stays a button. */
.sync__action {
  padding: 0;
  background: none;
  border: 0;
  font: 400 12px/1.45 var(--vh-sans);
  color: var(--vh-accent);
  transition: color var(--vh-t-color);
}

.sync__action:hover {
  color: var(--vh-050);
}

.sync__action--danger {
  color: var(--vh-danger);
}

.sync__action--danger:hover {
  color: var(--vh-danger-strong);
}

.sync__dot {
  color: var(--vh-400);
}

.sync__error {
  margin: 6px 0 0;
  max-width: 220px;
  text-align: right;
  font: 400 11px/1.4 var(--vh-sans);
  color: var(--vh-danger-strong);
}
</style>
