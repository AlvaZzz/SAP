// Declaraciones para imports de side-effect (hojas de estilo) y módulos CSS.
// Next.js procesa estos imports en build; TypeScript necesita la declaración
// para no marcar ts(2882) "Cannot find module … for side-effect import".

declare module '*.css';
declare module '*.scss';

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
