<script setup lang="ts">
import SectionRule from '@/components/SectionRule.vue';
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
    </div>
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
</style>
