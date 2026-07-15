// Interface languages. Scripture quotes stay in English (the 84000 translation):
// translating them ourselves would break quote fidelity, so only UI text localises.
import { ES_CONTENT } from './i18n-es.js';

export const STR = {
  en: {
    title: 'The Play in Full',
    subtitle: 'a pilgrimage in twelve deeds',
    begin: 'BEGIN', monk: 'MONK', nun: 'NUN',
    hint: 'WASD move · mouse look · E talk · F bow · R bowl · Ctrl sit · Shift run · Space jump',
    loading: 'gathering the grove…',
    cont: 'continue ›', close: 'close ✕', silent: '· remain silent ·',
    resume: 'CONTINUE', restart: 'START OVER',
    mindfulness: 'MINDFULNESS', rotate: 'PLEASE TURN YOUR DEVICE',
    endTitle: 'Here ends the Play in Full.',
    endSub: 'The grove is yours to wander.',
    returnBtn: 'RETURN TO THE GROVE',
    support: 'SUPPORT THIS PROJECT',
    supportUrl: 'https://offeringbowl.org',
    regard: 'regards you kindly.',
    scriptureNote: '',
    nudge: 'Walk up to the golden speech bubble and press E to continue the story',
    nudgeTouch: 'Walk up to the golden speech bubble and tap 💬 to continue the story',
  },
  es: {
    title: 'La Obra Completa',
    subtitle: 'una peregrinación en doce actos',
    begin: 'COMENZAR', monk: 'MONJE', nun: 'MONJA',
    hint: 'WASD moverse · ratón mirar · E hablar · F reverencia · R cuenco · Ctrl sentarse · Mayús correr · Espacio saltar',
    loading: 'preparando la arboleda…',
    cont: 'continuar ›', close: 'cerrar ✕', silent: '· guardar silencio ·',
    resume: 'CONTINUAR', restart: 'EMPEZAR DE NUEVO',
    mindfulness: 'ATENCIÓN PLENA', rotate: 'GIRA TU DISPOSITIVO',
    endTitle: 'Aquí termina la Obra Completa.',
    endSub: 'La arboleda es tuya para recorrerla.',
    returnBtn: 'VOLVER A LA ARBOLEDA',
    support: 'APOYA EL PROYECTO',
    supportUrl: 'https://cuencodeofrendas.org',
    regard: 'Te contempla con bondad.',
    scriptureNote: 'Las citas de las escrituras se muestran en inglés (traducción de 84000).',
    nudge: '',        // left for the translation agent
    nudgeTouch: '',   // left for the translation agent
  },
};

export let LANG = localStorage.getItem('pif-lang') || 'en';
export function setLang(l) { LANG = STR[l] ? l : 'en'; localStorage.setItem('pif-lang', LANG); }
// empty strings fall back to English, so untranslated entries never blank the UI
export const T = (k) => STR[LANG][k] || STR.en[k];

// Content translation by English key: names, 'who' labels, player questions and
// other non-scripture lines. Verbatim scripture never goes through here with a
// translation (see i18n-es.js header); an empty or missing entry shows English.
export const tr = (s) => (LANG === 'es' && s && ES_CONTENT[s]) || s;
