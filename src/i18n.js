// Interface languages. Scripture quotes stay in English (the 84000 translation):
// translating them ourselves would break quote fidelity, so only UI text localises.
export const STR = {
  en: {
    title: 'The Play in Full',
    subtitle: 'a pilgrimage in twelve deeds',
    begin: 'BEGIN', monk: 'MONK', nun: 'NUN',
    hint: 'WASD move · mouse look · E talk · F bow · R bowl · Ctrl sit · Shift run · Space jump',
    loading: 'gathering the grove…',
    cont: 'continue ›', close: 'close ✕', silent: '· remain silent ·',
    mindfulness: 'MINDFULNESS', rotate: 'PLEASE TURN YOUR DEVICE',
    endTitle: 'Here ends the Play in Full.',
    endSub: 'The grove is yours to wander.',
    returnBtn: 'RETURN TO THE GROVE',
    support: 'SUPPORT THIS PROJECT',
    supportUrl: 'https://offeringbowl.org',
    regard: 'regards you kindly.',
    scriptureNote: '',
  },
  es: {
    title: 'La Obra Completa',
    subtitle: 'una peregrinación en doce actos',
    begin: 'COMENZAR', monk: 'MONJE', nun: 'MONJA',
    hint: 'WASD moverse · ratón mirar · E hablar · F reverencia · R cuenco · Ctrl sentarse · Mayús correr · Espacio saltar',
    loading: 'preparando la arboleda…',
    cont: 'continuar ›', close: 'cerrar ✕', silent: '· guardar silencio ·',
    mindfulness: 'ATENCIÓN PLENA', rotate: 'GIRA TU DISPOSITIVO',
    endTitle: 'Aquí termina la Obra Completa.',
    endSub: 'La arboleda es tuya para recorrerla.',
    returnBtn: 'VOLVER A LA ARBOLEDA',
    support: 'APOYA EL PROYECTO',
    supportUrl: 'https://cuencodeofrendas.org',
    regard: 'Te contempla con bondad.',
    scriptureNote: 'Las citas de las escrituras se muestran en inglés (traducción de 84000).',
  },
};

export let LANG = localStorage.getItem('pif-lang') || 'en';
export function setLang(l) { LANG = STR[l] ? l : 'en'; localStorage.setItem('pif-lang', LANG); }
export const T = (k) => STR[LANG][k] ?? STR.en[k];
