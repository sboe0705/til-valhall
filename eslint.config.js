import { globalIgnores } from 'eslint/config';
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import pluginVue from 'eslint-plugin-vue';

export default defineConfigWithVueTs(
  {
    name: 'til-valhall/files-to-lint',
    files: ['**/*.{ts,mts,vue}'],
  },

  globalIgnores([
    '**/dist/**',
    '**/dev-dist/**',
    '**/coverage/**',
    '**/playwright-report/**',
    '**/test-results/**',
    // Design reference, not production code – see design_handoff_til_valhall/README.md.
    'design_handoff_til_valhall/**',
  ]),

  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  skipFormatting,

  {
    name: 'til-valhall/rules',
    rules: {
      // The model deliberately uses `as any` in one narrow spot (schedule.ts).
      '@typescript-eslint/no-explicit-any': 'warn',
      'vue/multi-word-component-names': 'off',
    },
  },
);
