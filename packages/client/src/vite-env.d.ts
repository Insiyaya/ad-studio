/// <reference types="vite/client" />

// CSS Modules - Vite handles the transform; TypeScript needs this declaration
// to resolve `import styles from './Foo.module.css'` without errors.
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
