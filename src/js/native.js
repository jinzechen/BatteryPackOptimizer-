import { Capacitor } from '@capacitor/core';

let Camera, Preferences, Haptics, StatusBar, SplashScreen, Share, Filesystem;

// Dynamic import so app works even without native plugins
async function loadPlugins() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const [cam, pref, hap, sb, ss, sh, fs] = await Promise.all([
      import('@capacitor/camera'),
      import('@capacitor/preferences'),
      import('@capacitor/haptics'),
      import('@capacitor/status-bar'),
      import('@capacitor/splash-screen'),
      import('@capacitor/share'),
      import('@capacitor/filesystem'),
    ]);
    Camera = cam.Camera;
    Preferences = pref.Preferences;
    Haptics = hap.Haptics;
    StatusBar = sb.StatusBar;
    SplashScreen = ss.SplashScreen;
    Share = sh.Share;
    Filesystem = fs.Filesystem;
  } catch (e) {
    console.warn('Capacitor plugins load failed:', e);
  }
}

export async function initNative() {
  await loadPlugins();
  try { await StatusBar?.setStyle?.({ style: 'DARK' }); } catch {}
  try { await StatusBar?.setBackgroundColor?.({ color: '#0c0e14' }); } catch {}
  try { await SplashScreen?.hide?.(); } catch {}
}

export async function takePhoto() {
  if (!Camera) return null;
  try {
    const photo = await Camera.getPhoto({
      quality: 80, resultType: 'base64', source: 'CAMERA', width: 1200,
    });
    return photo.base64String;
  } catch { return null; }
}

export async function pickImage() {
  if (!Camera) return null;
  try {
    const photo = await Camera.getPhoto({
      quality: 80, resultType: 'base64', source: 'PHOTOS',
    });
    return photo.base64String;
  } catch { return null; }
}

export async function savePref(key, val) {
  if (Preferences) {
    await Preferences.set({ key, value: JSON.stringify(val) });
  } else {
    localStorage.setItem(key, JSON.stringify(val));
  }
}

export async function loadPref(key) {
  if (Preferences) {
    const { value } = await Preferences.get({ key });
    return value ? JSON.parse(value) : null;
  }
  const v = localStorage.getItem(key);
  return v ? JSON.parse(v) : null;
}

export async function vibrate(ms = 30) {
  try { await Haptics?.vibrate?.({ duration: ms }); } catch {}
}

export async function exportFile(name, data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  if (Filesystem && Share) {
    try {
      await Filesystem.writeFile({ path: name, data: str, directory: 'DOCUMENTS', encoding: 'utf8' });
      const uri = await Filesystem.getUri({ path: name, directory: 'DOCUMENTS' });
      await Share.share({ title: '排布方案', url: uri.uri });
      return true;
    } catch (e) { console.error(e); }
  }
  // Web fallback
  const blob = new Blob([str], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  return true;
}

export const isNative = () => Capacitor.isNativePlatform();
