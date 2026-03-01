/// <reference types="react-scripts" />

interface ImportMetaEnv {
  readonly REACT_APP_NEON_DATABASE_URL: string;
  readonly REACT_APP_JWT_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
