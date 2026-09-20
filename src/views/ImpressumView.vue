<script setup lang="ts">
import { ref, useTemplateRef } from 'vue';

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
  location.reload();
}
</script>

<template>
  <div class="vh-screen">
    <RouterLink class="back" to="/heute">‹ zurück</RouterLink>

    <header class="head">
      <span class="vh-eyebrow vh-eyebrow--page">Rechtliches</span>
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
      <p>
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

    <SectionRule label="Deine Daten" />

    <div class="vh-card legal">
      <p>
        Trainingsplan, Sitzungen und Ränge liegen ausschließlich im
        <span class="legal__code">localStorage</span> dieses Geräts – unter den Schlüsseln
        <span class="legal__code">til-valhall.training</span> und
        <span class="legal__code">til-valhall.ranks</span>.
      </p>
      <p>
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
  </div>
</template>

<style scoped>
.back {
  font: 400 11px/1 var(--vh-mono);
  color: var(--vh-200);
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
  border: 1px solid var(--vh-line);
  border-radius: var(--vh-r-panel);
  background: var(--vh-900);
}
</style>
