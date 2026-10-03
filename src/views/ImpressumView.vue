<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue';

import SectionRule from '@/components/SectionRule.vue';
import {
  applyBackup,
  backupFilename,
  collectBackup,
  parseBackup,
  serializeBackup,
  type Backup,
  type BackupError,
} from '@/app/backup';
import { useSyncStore } from '@/stores/sync';

const sync = useSyncStore();

const syncLine = computed(() => {
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

const fileInput = useTemplateRef<HTMLInputElement>('fileInput');

/** Neutral status line – set after an export, cleared when an import starts. */
const note = ref('');
const error = ref('');
/** A validated file waiting for the overwrite confirmation. */
const pending = ref<{ backup: Backup; filename: string } | null>(null);

const ERRORS: Record<BackupError, string> = {
  'invalid-json': 'Die Datei ist kein gültiges JSON.',
  'not-a-backup': 'Das ist kein Til-Valhall-Backup.',
  'wrong-schema': 'Das Backup stammt aus einer anderen Version der App.',
};

function clearMessages(): void {
  note.value = '';
  error.value = '';
  pending.value = null;
}

function exportBackup(): void {
  clearMessages();

  const filename = backupFilename();
  const blob = new Blob([serializeBackup(collectBackup(localStorage))], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);

  note.value = `${filename} heruntergeladen.`;
}

async function pickFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  // Reset the input right away, or picking the same file twice fires no second
  // `change` event.
  input.value = '';
  if (!file) return;

  clearMessages();
  const result = parseBackup(await file.text());
  if (!result.ok) {
    error.value = ERRORS[result.reason];
    return;
  }
  pending.value = { backup: result.backup, filename: file.name };
}

/**
 * Write the backup and reload.
 *
 * The reload is deliberate: hydration through the persistence plugin is the
 * only path that brings both slices up in the right order, with the training
 * store's `afterHydrate` check in place. Pushing the state into the stores by
 * hand would bypass all of it.
 */
function confirmImport(): void {
  if (!pending.value) return;
  applyBackup(localStorage, pending.value.backup);
  // The imported state is a local edit – without this the next sync would see
  // nothing to upload and a later Drive change would quietly replace it.
  sync.markDirty();
  location.reload();
}
</script>

<template>
  <div class="vh-screen">
    <RouterLink class="back" to="/heute">‹ zurück</RouterLink>

    <header class="head">
      <span class="vh-eyebrow">Rechtliches</span>
      <h1 class="vh-h1">Impressum</h1>
      <span class="vh-sub">Privates, nicht-kommerzielles Hobbyprojekt.</span>
    </header>

    <div class="vh-card legal">
      <p>Angaben gemäß § 5 DDG:</p>
      <p class="legal__address">
        Sebastian Böhm<br />
        Karlsruher Straße 26<br />
        70771 Echterdingen<br />
        Deutschland
      </p>
      <p>Kontakt: sboe0705@icloud.com</p>
    </div>

    <SectionRule label="Haftung für Inhalte" />

    <div class="vh-card legal">
      <p>
        Dies ist ein privates, nicht-kommerzielles Hobbyprojekt. Für externe Links wird
        keine Haftung übernommen; zum Zeitpunkt der Verlinkung waren keine Rechtsverstöße
        erkennbar.
      </p>
    </div>

    <SectionRule label="Datenschutz" />

    <div class="vh-card legal">
      <p v-if="sync.enabled">
        Ohne Anmeldung speichert diese Website selbst keine personenbezogenen Daten,
        verwendet keine Cookies und bindet keine Tracker ein. Was sich mit der optionalen
        Google-Anmeldung ändert, steht unten.
      </p>
      <p v-else>
        Diese Website speichert selbst keine personenbezogenen Daten, verwendet keine
        Cookies und bindet keine Tracker ein.
      </p>
      <p>
        Die Seite wird über GitHub Pages (GitHub Inc., USA) gehostet. GitHub erfasst beim
        Aufruf technisch bedingt Server-Logs (u.a. IP-Adresse) zur Sicherstellung des
        Betriebs. Details:
        <a
          class="legal__link"
          href="https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement"
          target="_blank"
          rel="noopener noreferrer"
        >
          docs.github.com/.../github-privacy-statement
        </a>
      </p>
    </div>

    <template v-if="sync.enabled">
      <SectionRule label="Google-Anmeldung" />

      <div class="vh-card legal">
        <p>
          Die Synchronisation über Google ist freiwillig. Erst ein Tipp auf „Mit Google
          anmelden“ lädt Google Identity Services; Rechtsgrundlage ist deine Einwilligung
          (Art. 6 Abs. 1 lit. a DSGVO), die du jederzeit durch Abmelden widerrufen kannst.
        </p>
        <p>
          Bei der Anmeldung verarbeitet Google (Google Ireland Ltd., Dublin;
          Muttergesellschaft Google LLC, USA) deine IP-Adresse und dein Google-Konto und
          setzt dafür eigene Cookies. Eine Übermittlung in die USA ist möglich; Google LLC
          ist nach dem EU-US Data Privacy Framework zertifiziert.
        </p>
        <p>
          Die App fordert nur zwei Dinge an: deine E-Mail-Adresse, um das verbundene Konto
          anzuzeigen, und Zugriff auf ihren eigenen, versteckten App-Ordner in deinem
          Google Drive (<span class="legal__code">drive.appdata</span>). Dort liegt eine
          Datei mit Trainingsplan, Sitzungen und Rängen. Andere Dateien deines Drive sieht
          die App nicht. Die Daten fließen direkt zwischen deinem Browser und Google – der
          Betreiber dieser Seite erhält sie nicht und hat keinen Zugriff darauf.
        </p>
        <p>
          Auf diesem Gerät legt die App dafür unter
          <span class="legal__code">til-valhall-sync</span> deine E-Mail-Adresse und einen
          etwa eine Stunde gültigen Zugriffsschlüssel ab. Abmelden löscht beides und
          widerruft den Schlüssel; die Datei in Google Drive bleibt bestehen. Den Zugriff
          kannst du außerdem jederzeit in deinem Google-Konto unter „Sicherheit →
          Drittanbieter-Apps“ entziehen (<a
            class="legal__link"
            href="https://myaccount.google.com/connections"
            target="_blank"
            rel="noopener noreferrer"
            >myaccount.google.com/connections</a
          >). Die Datei selbst entfernst du in Google Drive unter „Einstellungen → Apps
          verwalten → Versteckte App-Daten löschen“.
        </p>
        <p>
          Die Nutzung und Übertragung von Informationen, die die App von Google-APIs
          erhält, entspricht der
          <a
            class="legal__link"
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google API Services User Data Policy</a
          >, einschließlich der Anforderungen zur eingeschränkten Nutzung (Limited Use).
          Die Daten dienen ausschließlich dem Abgleich zwischen deinen Geräten; sie werden
          weder weitergegeben noch ausgewertet.
        </p>
        <p>
          Details zur Verarbeitung durch Google:
          <a
            class="legal__link"
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            policies.google.com/privacy
          </a>
        </p>
      </div>
    </template>

    <SectionRule label="Deine Daten" />

    <div class="vh-card legal">
      <p>
        Trainingsplan, Sitzungen und Ränge liegen ausschließlich im
        <span class="legal__code">localStorage</span> dieses Geräts – unter den Schlüsseln
        <span class="legal__code">til-valhall.training</span> und
        <span class="legal__code">til-valhall.ranks</span>.
      </p>
      <p v-if="sync.enabled">
        Ohne Anmeldung wird nichts an einen Server übertragen; wer die Browserdaten
        löscht, löscht auch den Fortschritt – es sei denn, er liegt per Synchronisation in
        Google Drive.
      </p>
      <p v-else>
        Es wird nichts an einen Server übertragen; wer die Browserdaten löscht, löscht
        auch den Fortschritt.
      </p>

      <p class="legal__actions">
        <button class="legal__action" type="button" @click="exportBackup">
          Exportieren
        </button>
        <span class="legal__dot">·</span>
        <button class="legal__action" type="button" @click="fileInput?.click()">
          Importieren
        </button>
      </p>

      <input
        ref="fileInput"
        class="legal__file"
        type="file"
        accept="application/json,.json"
        tabindex="-1"
        aria-hidden="true"
        @change="pickFile"
      />

      <p v-if="note" class="legal__note">{{ note }}</p>
      <p v-if="error" class="legal__note legal__note--error">{{ error }}</p>

      <div v-if="pending" class="legal__confirm">
        <p>
          <span class="legal__code">{{ pending.filename }}</span> überschreibt alle Daten
          auf diesem Gerät.
        </p>
        <p class="legal__actions">
          <button
            class="legal__action legal__action--danger"
            type="button"
            @click="confirmImport"
          >
            Überschreiben
          </button>
          <span class="legal__dot">·</span>
          <button class="legal__action" type="button" @click="clearMessages">
            Abbrechen
          </button>
        </p>
      </div>
    </div>

    <template v-if="sync.enabled">
      <SectionRule label="Synchronisation" />

      <div class="vh-card legal">
        <template v-if="!sync.email">
          <p>
            Mit einem Google-Konto werden Plan, Sitzungen und Ränge automatisch zwischen
            deinen Geräten abgeglichen – über den App-Ordner deines Google Drive. Die App
            sieht dort nur ihre eigene Datei.
          </p>
          <p class="legal__actions">
            <button
              class="legal__action"
              type="button"
              :aria-disabled="sync.status === 'connecting'"
              @click="sync.status !== 'connecting' && sync.signIn()"
            >
              Mit Google anmelden
            </button>
          </p>
        </template>

        <template v-else>
          <p>
            Angemeldet als <span class="legal__code">{{ sync.email }}</span>
          </p>
          <p v-if="syncLine" class="legal__note">{{ syncLine }}</p>
          <p class="legal__actions">
            <template v-if="sync.status === 'expired'">
              <button class="legal__action" type="button" @click="sync.signIn()">
                Fortsetzen
              </button>
              <span class="legal__dot">·</span>
            </template>
            <button class="legal__action" type="button" @click="sync.signOut()">
              Abmelden
            </button>
          </p>

          <div v-if="sync.status === 'ask'" class="legal__confirm">
            <p>
              In deinem Google Drive liegt schon ein Stand. Welcher soll ab jetzt auf
              allen Geräten gelten?
            </p>
            <p class="legal__actions">
              <button
                class="legal__action legal__action--danger"
                type="button"
                @click="sync.chooseRemote()"
              >
                Drive-Stand übernehmen
              </button>
              <span class="legal__dot">·</span>
              <button class="legal__action" type="button" @click="sync.chooseLocal()">
                Dieses Gerät hochladen
              </button>
            </p>
          </div>
        </template>

        <p v-if="sync.error" class="legal__note legal__note--error">{{ sync.error }}</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.back {
  font: 400 11px/1 var(--vh-mono);
  color: var(--vh-400);
  text-decoration: none;
  align-self: flex-start;
  transition: color var(--vh-t-color);
}

.back:hover {
  color: var(--vh-200);
}

.head {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.legal {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 14px 15px;
  font: 400 12px/1.55 var(--vh-sans);
  color: var(--vh-200);
}

.legal p {
  margin: 0;
}

.legal__address {
  font: 400 11px/1.5 var(--vh-mono);
  color: var(--vh-050);
}

.legal__link {
  color: var(--vh-accent);
  /* The URL is one long token and has to break somewhere – but only as a last
     resort, so the German prose around it keeps wrapping on word boundaries. */
  overflow-wrap: anywhere;
}

.legal__code {
  font: 400 11px/1 var(--vh-mono);
  color: var(--vh-050);
}

.legal__actions {
  display: flex;
  align-items: baseline;
  gap: 7px;
}

/* A link in everything but the element – it acts, so it stays a button. */
.legal__action {
  padding: 0;
  background: none;
  border: 0;
  font: 400 12px/1.55 var(--vh-sans);
  color: var(--vh-accent);
  transition: color var(--vh-t-color);
}

.legal__action:hover {
  color: var(--vh-050);
}

.legal__action--danger {
  color: var(--vh-danger);
}

.legal__action--danger:hover {
  color: var(--vh-danger-strong);
}

.legal__dot {
  color: var(--vh-400);
}

/* Kept in the layout but invisible – `display: none` would take it out of the
   accessibility tree and out of reach of the button above. */
.legal__file {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.legal__note {
  font: 400 11px/1.5 var(--vh-mono);
  color: var(--vh-400);
}

.legal__note--error {
  color: var(--vh-danger);
}

.legal__confirm {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 11px 12px;
  border: 1px solid var(--vh-600);
  border-radius: var(--vh-r-panel);
  background: var(--vh-900);
}
</style>
