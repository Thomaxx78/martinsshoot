import { Capacitor, registerPlugin } from "@capacitor/core";

export const isNativeAndroid =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

export const ShootNative = registerPlugin("ShootNative");

export function nativePhotoUrl(photo) {
  return Capacitor.convertFileSrc(photo.uri);
}
