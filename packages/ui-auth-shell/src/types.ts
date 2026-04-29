export type CurrentUser = {
  sub: string;
  email: string | null;
  name: string | null;
};

export type PublicAuthShellConfig = {
  auth0: {
    domain: string;
    clientId: string;
    audience: string;
    redirectUri: string;
    scope?: string;
  };
  runtime: {
    manifestUrl: string;
  };
};

export type AuthShellConfig = PublicAuthShellConfig & {
  runtime: PublicAuthShellConfig['runtime'] & {
    target: HTMLElement;
  };
};

export type MountResult = {
  unmount: () => void;
};
