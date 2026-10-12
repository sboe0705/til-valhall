<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue';

import { useSyncStore } from '@/stores/sync';

/**
 * The Google sign-in as a rune chip in the Heute header – "Anmelden" while
 * signed out, "Sync" once connected. Ehwaz `ᛖ`, two horses moving as one,
 * stands for the sync; Thurisaz `ᚦ`, the error rune of the plan check, replaces it when
 * something needs attention. Tapping the connected chip opens a small panel with
 * the account, the status line and "Abmelden" – unless the sign-in has expired,
 * then the tap renews it straight away. Renders nothing unless the build has a
 * Google client id.
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

/** A popup or a run is under way – the chip waits instead of acting twice. */
const busy = computed(() => sync.status === 'connecting');

type Tone = 'idle' | 'ok' | 'busy' | 'alert';

const tone = computed<Tone>(() => {
  if (!sync.email) return busy.value ? 'busy' : 'idle';
  if (alert.value) return 'alert';
  if (busy.value || sync.status === 'syncing') return 'busy';
  return 'ok';
});

const rune = computed(() => (tone.value === 'alert' ? 'ᚦ' : 'ᛖ'));

const label = computed(() => {
  if (sync.email) return 'Sync';
  return busy.value ? 'Anmeldung …' : 'Anmelden';
});

/**
 * Signed out → sign in. Expired → renew right here: the tap is what lets
 * Google's popup open, and GIS is already loaded by `start()`. Only if that
 * renewal does not go through does the panel open, so "Abmelden" stays in reach.
 */
async function onPill(): Promise<void> {
  if (busy.value) return;
  if (!sync.email) return sync.signIn();
  if (sync.status === 'expired') {
    open.value = false;
    await sync.signIn();
    if (sync.status === 'expired') open.value = true;
    return;
  }
  open.value = !open.value;
}

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
      class="sync__pill"
      :class="`sync__pill--${tone}`"
      type="button"
      :aria-disabled="busy"
      :aria-expanded="sync.email ? open : undefined"
      :title="sync.email ? `Angemeldet als ${sync.email}` : undefined"
      @click="onPill"
    >
      <span class="vh-rune sync__rune" aria-hidden="true">{{ rune }}</span>
      {{ label }}
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
  gap: 6px;
  height: 30px;
  padding: 0 11px 0 9px;
  background: var(--vh-900);
  border: 1px solid var(--vh-600);
  border-radius: var(--vh-r-chip);
  font: 600 13px/1 var(--vh-heading);
  letter-spacing: 0.02em;
  color: var(--vh-200);
  transition:
    color var(--vh-t-color),
    border-color var(--vh-t-color);
}

.sync__pill:hover {
  color: var(--vh-050);
}

.sync__pill[aria-disabled='true'] {
  cursor: default;
}

.sync__rune {
  font-size: 15px;
  line-height: 1;
  color: var(--vh-400);
  transition: color var(--vh-t-color);
}

.sync__pill--ok .sync__rune {
  color: var(--vh-success);
}

.sync__pill--busy .sync__rune {
  color: var(--vh-accent);
  animation: sync-pulse 1.4s ease-in-out infinite;
}

.sync__pill--alert {
  color: var(--vh-danger-strong);
  border-color: var(--vh-danger);
}

.sync__pill--alert:hover {
  color: var(--vh-danger-strong);
}

.sync__pill--alert .sync__rune {
  color: var(--vh-danger-strong);
}

/* Opacity only – the palette has no glows. */
@keyframes sync-pulse {
  50% {
    opacity: 0.35;
  }
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
