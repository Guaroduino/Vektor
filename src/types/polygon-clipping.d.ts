// Minimal type declarations for polygon-clipping to satisfy TypeScript.
// The library performs boolean operations on polygon geometries.
declare module 'polygon-clipping' {
  const clipping: {
    union(...geoms: any[]): any;
    intersection(...geoms: any[]): any;
    difference(...geoms: any[]): any;
    xor(...geoms: any[]): any;
  };
  export default clipping;
}
