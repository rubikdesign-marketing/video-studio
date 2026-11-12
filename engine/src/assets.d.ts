// Font files imported from npm packages resolve to a URL in the bundle.
declare module '*.woff2' {
  const url: string;
  export default url;
}
