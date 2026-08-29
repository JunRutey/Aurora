/**
 * 用户偏好管理
 *
 * 已迁移到客户端缓存系统 (src/cache/)，通过 SettingsCache 统一管理
 * 本文件保留所有 DOM 操作和业务逻辑函数，只替换存储层
 *
 * @author CuteLeaf <xiaye@msn.com>
 */

import {
	DARK_MODE,
	DEFAULT_THEME,
	LIGHT_MODE,
	SYSTEM_MODE,
	WALLPAPER_BANNER,
	WALLPAPER_FULLSCREEN,
	WALLPAPER_NONE,
	WALLPAPER_OVERLAY,
} from "@constants/constants";
import type { LIGHT_DARK_MODE, WALLPAPER_MODE } from "@/types/config";
import {
	backgroundWallpaper,
	displaySettingsConfig,
	expressiveCodeConfig,
	siteConfig,
} from "../config";
import { isHomePage as checkIsHomePage } from "./layout-utils";
import { getSettingsCache } from "@/cache/settings-cache";

// ─── 缓存便捷访问 ─────────────────────────────────────────────

const settings = () => getSettingsCache();

// ─── 全局声明 ─────────────────────────────────────────────────

declare global {
	interface Window {
		initSemifullScrollDetection?: () => void;
		semifullScrollHandler?: () => void;
	}
}

// ─── 工具函数 ─────────────────────────────────────────────────

function clampNumber(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

// ─── 主题默认值 ───────────────────────────────────────────────

export function getDefaultHue(): number {
	const fallback = "250";
	if (typeof document === "undefined") {
		return Number.parseInt(fallback, 10);
	}
	const configCarrier = document.getElementById("config-carrier");
	return Number.parseInt(configCarrier?.dataset.hue || fallback, 10);
}

export function getDefaultTheme(): LIGHT_DARK_MODE {
	return siteConfig.themeColor.defaultMode ?? DEFAULT_THEME;
}

export function getSystemTheme(): LIGHT_DARK_MODE {
	if (typeof window === "undefined") {
		return LIGHT_MODE;
	}
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? DARK_MODE
		: LIGHT_MODE;
}

export function resolveTheme(theme: LIGHT_DARK_MODE): LIGHT_DARK_MODE {
	if (theme === SYSTEM_MODE) {
		return getSystemTheme();
	}
	return theme;
}

// ─── Hue ──────────────────────────────────────────────────────

export function getHue(): number {
	if (typeof window === "undefined") return getDefaultHue();
	const stored = settings().get("hue");
	return stored ? Number.parseInt(stored, 10) : getDefaultHue();
}

export function setHue(hue: number): void {
	if (typeof window === "undefined" || typeof document === "undefined") return;
	settings().set("hue", String(hue));
	const r = document.querySelector(":root") as HTMLElement;
	if (r) r.style.setProperty("--hue", String(hue));
}

// ─── 主题 DOM 操作 ────────────────────────────────────────────

export function applyThemeToDocument(theme: LIGHT_DARK_MODE): void {
	if (typeof document === "undefined") return;

	const resolvedTheme = resolveTheme(theme);
	const currentIsDark = document.documentElement.classList.contains("dark");
	const currentTheme = document.documentElement.getAttribute("data-theme");

	let targetIsDark = false;
	switch (resolvedTheme) {
		case LIGHT_MODE:
			targetIsDark = false;
			break;
		case DARK_MODE:
			targetIsDark = true;
			break;
		default:
			targetIsDark = currentIsDark;
			break;
	}

	const needsThemeChange = currentIsDark !== targetIsDark;
	const expectedTheme = targetIsDark
		? expressiveCodeConfig.darkTheme
		: expressiveCodeConfig.lightTheme;
	const needsCodeThemeUpdate = currentTheme !== expectedTheme;

	if (!needsThemeChange && !needsCodeThemeUpdate) return;

	if (needsThemeChange) {
		if (targetIsDark) {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}
	}

	if (needsCodeThemeUpdate) {
		document.documentElement.setAttribute("data-theme", expectedTheme);
	}
}

// ─── 系统主题监听 ─────────────────────────────────────────────

let systemThemeListener:
	| ((e: MediaQueryListEvent | MediaQueryList) => void)
	| null = null;

export function setupSystemThemeListener(): void {
	cleanupSystemThemeListener();
	if (typeof window === "undefined") return;

	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

	const handleSystemThemeChange = (e: MediaQueryListEvent | MediaQueryList) => {
		const isDark = e.matches;
		const currentIsDark = document.documentElement.classList.contains("dark");
		if (currentIsDark === isDark) return;

		if (isDark) {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}

		const expressiveTheme = isDark
			? expressiveCodeConfig.darkTheme
			: expressiveCodeConfig.lightTheme;
		document.documentElement.setAttribute("data-theme", expressiveTheme);
		window.dispatchEvent(new CustomEvent("theme-change"));
	};

	handleSystemThemeChange(mediaQuery);

	if (mediaQuery.addEventListener) {
		mediaQuery.addEventListener("change", handleSystemThemeChange);
	} else {
		mediaQuery.addListener(handleSystemThemeChange);
	}

	systemThemeListener = handleSystemThemeChange;
}

function cleanupSystemThemeListener() {
	if (typeof window === "undefined" || !systemThemeListener) return;
	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
	if (mediaQuery.removeEventListener) {
		mediaQuery.removeEventListener("change", systemThemeListener);
	} else {
		mediaQuery.removeListener(systemThemeListener);
	}
	systemThemeListener = null;
}

// ─── 主题读写 ─────────────────────────────────────────────────

export function setTheme(theme: LIGHT_DARK_MODE): void {
	if (typeof window === "undefined") return;

	applyThemeToDocument(theme);
	settings().set("theme", theme);

	if (theme === SYSTEM_MODE) {
		setupSystemThemeListener();
	} else {
		cleanupSystemThemeListener();
	}
}

export function getStoredTheme(): LIGHT_DARK_MODE {
	if (typeof window === "undefined") return getDefaultTheme();
	return (settings().get("theme") as LIGHT_DARK_MODE) || getDefaultTheme();
}

export function initThemeListener(): void {
	if (typeof window === "undefined") return;
	const theme = getStoredTheme();
	if (theme === SYSTEM_MODE) {
		setupSystemThemeListener();
	}
}

// ─── 壁纸模式 ─────────────────────────────────────────────────

export function syncBannerHomeTextVisibility(): void {
	const overlay = document.querySelector(
		".banner-home-text-overlay",
	) as HTMLElement | null;
	if (!overlay) return;
	const mode = document.documentElement.getAttribute("data-wallpaper-mode");
	const isHome = checkIsHomePage(window.location.pathname);
	const show =
		isHome && (mode === WALLPAPER_BANNER || mode === WALLPAPER_FULLSCREEN);
	overlay.classList.toggle("hidden", !show);
}

export function applyWallpaperModeToDocument(
	mode: WALLPAPER_MODE,
	animate = true,
): void {
	const html = document.documentElement;
	const prevMode = html.getAttribute("data-wallpaper-mode");

	if (animate) {
		html.classList.add("is-wallpaper-transitioning");
		window.setTimeout(
			() => html.classList.remove("is-wallpaper-transitioning"),
			520,
		);
	}

	html.setAttribute("data-wallpaper-mode", mode);
	syncBannerHomeTextVisibility();

	const transparent = mode === "overlay" || mode === "fullscreen";
	document.body.classList.toggle("wallpaper-transparent", transparent);

	if (
		(mode === WALLPAPER_FULLSCREEN && prevMode === WALLPAPER_BANNER) ||
		(mode === WALLPAPER_BANNER && prevMode === WALLPAPER_FULLSCREEN)
	) {
		const title = document.querySelector(
			".banner-home-text-overlay",
		) as HTMLElement | null;
		if (title && !title.classList.contains("hidden")) {
			const deltaVh = mode === WALLPAPER_FULLSCREEN ? -17.5 : 17.5;
			title.style.transition = "none";
			title.style.transform = `translateY(${deltaVh}vh)`;
			void title.offsetWidth;
			title.style.transition =
				"transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
			title.style.transform = "translateY(0)";
		}
	}

	updateNavbarTransparency(mode);
	window.dispatchEvent(
		new CustomEvent("wallpaperModeChange", { detail: { mode } }),
	);
}

export function updateNavbarTransparency(mode: WALLPAPER_MODE): void {
	const navbar = document.getElementById("navbar");
	if (!navbar) return;

	let transparentMode: string;
	let blurAmount: number;

	if (mode === WALLPAPER_OVERLAY) {
		transparentMode = "none";
		blurAmount = 0;
	} else if (mode === WALLPAPER_NONE) {
		transparentMode = "none";
		blurAmount = 0;
	} else if (mode === WALLPAPER_FULLSCREEN) {
		const isHomePage = checkIsHomePage(window.location.pathname);
		const dynamicTransparent =
			backgroundWallpaper.fullscreen?.navbar?.dynamicTransparent ?? false;
		if (isHomePage && dynamicTransparent) {
			transparentMode = "semifull";
			blurAmount = 0;
		} else {
			transparentMode = "none";
			blurAmount = 0;
		}
	} else {
		transparentMode =
			backgroundWallpaper.banner?.navbar?.transparentMode || "semi";
		blurAmount = backgroundWallpaper.banner?.navbar?.blur ?? 20;
	}

	navbar.setAttribute("data-transparent-mode", transparentMode);
	navbar.style.setProperty("--navbar-glass-blur", `${blurAmount}px`);

	navbar.classList.remove(
		"navbar-transparent-semi",
		"navbar-transparent-full",
		"navbar-transparent-semifull",
	);

	navbar.classList.remove("scrolled");

	if (
		transparentMode === "semifull" &&
		(mode === WALLPAPER_BANNER || mode === WALLPAPER_FULLSCREEN) &&
		typeof window.initSemifullScrollDetection === "function"
	) {
		window.initSemifullScrollDetection();
	} else if (window.semifullScrollHandler) {
		window.removeEventListener("scroll", window.semifullScrollHandler);
		delete window.semifullScrollHandler;
	}
}

export function setWallpaperMode(mode: WALLPAPER_MODE): void {
	if (typeof window === "undefined") return;
	settings().set("wallpaperMode", mode);
	applyWallpaperModeToDocument(mode);
}

export function initWallpaperMode(): void {
	applyStoredOverlaySettingsToDocument();
	const storedMode = getStoredWallpaperMode();
	applyWallpaperModeToDocument(storedMode, false);
}

/**
 * 获取当前设备的默认壁纸模式
 * 移动端优先使用 mobileMode，桌面端使用 mode
 */
function getDefaultWallpaperMode(): WALLPAPER_MODE {
	const isMobile =
		typeof window !== "undefined" && window.innerWidth < 768;
	if (isMobile && backgroundWallpaper.mobileMode) {
		return backgroundWallpaper.mobileMode;
	}
	return backgroundWallpaper.mode;
}

/**
 * 获取已存储的壁纸模式
 * 用户手动修改过 → 使用用户设置
 * 未修改过 → 使用当前设备对应的默认值（移动端/桌面端）
 */
export function getStoredWallpaperMode(): WALLPAPER_MODE {
	if (typeof window === "undefined") return getDefaultWallpaperMode();

	const isSwitchable = displaySettingsConfig.wallpaperModeSwitchable;
	if (!isSwitchable) {
		return getDefaultWallpaperMode();
	}

	return (
		(settings().get("wallpaperMode") as WALLPAPER_MODE) ||
		getDefaultWallpaperMode()
	);
}

// ─── Overlay 设置 ──────────────────────────────────────────────

export function getDefaultOverlayOpacity(): number {
	return backgroundWallpaper.overlay?.opacity ?? 0.8;
}

export function getDefaultOverlayBlur(): number {
	return backgroundWallpaper.overlay?.blur ?? 0;
}

export function getDefaultOverlayCardOpacity(): number {
	return backgroundWallpaper.overlay?.cardOpacity ?? 0.6;
}

export function getStoredOverlayOpacity(): number {
	if (typeof window === "undefined") return getDefaultOverlayOpacity();
	const stored = settings().getTyped("overlayOpacity", getDefaultOverlayOpacity());
	return clampNumber(stored, 0, 1);
}

export function getStoredOverlayBlur(): number {
	if (typeof window === "undefined") return getDefaultOverlayBlur();
	const stored = settings().getTyped("overlayBlur", getDefaultOverlayBlur());
	return clampNumber(stored, 0, 20);
}

export function getStoredOverlayCardOpacity(): number {
	if (typeof window === "undefined") return getDefaultOverlayCardOpacity();
	const stored = settings().getTyped("overlayCardOpacity", getDefaultOverlayCardOpacity());
	return clampNumber(stored, 0, 1);
}

export function applyOverlayOpacityToDocument(opacity: number): void {
	if (typeof document === "undefined") return;
	const safeOpacity = clampNumber(opacity, 0, 1);
	const wallpaperWrapper = document.getElementById("wallpaper-wrapper");
	if (wallpaperWrapper) {
		wallpaperWrapper.style.setProperty("--overlay-opacity", String(safeOpacity));
	}
}

export function applyOverlayBlurToDocument(blur: number): void {
	if (typeof document === "undefined") return;
	const safeBlur = clampNumber(blur, 0, 20);
	const wallpaperWrapper = document.getElementById("wallpaper-wrapper");
	if (wallpaperWrapper) {
		wallpaperWrapper.style.setProperty("--overlay-blur", `${safeBlur}px`);
	}
}

export function applyOverlayCardOpacityToDocument(cardOpacity: number): void {
	if (typeof document === "undefined") return;
	const safeCardOpacity = clampNumber(cardOpacity, 0, 1);
	document.documentElement.style.setProperty(
		"--card-transparent-opacity",
		String(safeCardOpacity),
	);
}

export function setOverlayOpacity(opacity: number): void {
	const safeOpacity = clampNumber(opacity, 0, 1);
	if (typeof window !== "undefined") {
		settings().set("overlayOpacity", String(safeOpacity));
	}
	applyOverlayOpacityToDocument(safeOpacity);
}

export function setOverlayBlur(blur: number): void {
	const safeBlur = clampNumber(blur, 0, 20);
	if (typeof window !== "undefined") {
		settings().set("overlayBlur", String(safeBlur));
	}
	applyOverlayBlurToDocument(safeBlur);
}

export function setOverlayCardOpacity(cardOpacity: number): void {
	const safeCardOpacity = clampNumber(cardOpacity, 0, 1);
	if (typeof window !== "undefined") {
		settings().set("overlayCardOpacity", String(safeCardOpacity));
	}
	applyOverlayCardOpacityToDocument(safeCardOpacity);
}

export function applyStoredOverlaySettingsToDocument(): void {
	applyOverlayOpacityToDocument(getStoredOverlayOpacity());
	applyOverlayBlurToDocument(getStoredOverlayBlur());
	applyOverlayCardOpacityToDocument(getStoredOverlayCardOpacity());
}

// ─── Waves 动画 ────────────────────────────────────────────────

export function getDefaultWavesEnabled(): boolean {
	const wavesConfig = backgroundWallpaper.banner?.waves?.enable;
	if (typeof wavesConfig === "object") {
		const isMobile =
			typeof window !== "undefined" ? window.innerWidth < 768 : false;
		return isMobile
			? (wavesConfig.mobile ?? false)
			: (wavesConfig.desktop ?? false);
	}
	return wavesConfig ?? false;
}

export function getStoredWavesEnabled(): boolean {
	if (typeof window === "undefined") return getDefaultWavesEnabled();
	return settings().getTyped("wavesEnabled", getDefaultWavesEnabled());
}

export function setWavesEnabled(enabled: boolean): void {
	if (typeof window === "undefined") return;
	settings().set("wavesEnabled", String(enabled));
	applyWavesEnabledToDocument(enabled);
}

export function applyWavesEnabledToDocument(enabled: boolean): void {
	if (typeof document === "undefined") return;
	document.documentElement.setAttribute("data-waves-enabled", String(enabled));
	const wavesElement = document.getElementById("header-waves");
	if (wavesElement) {
		if (enabled) {
			wavesElement.style.display = "";
			wavesElement.classList.remove("waves-disabled");
		} else {
			wavesElement.style.display = "none";
			wavesElement.classList.add("waves-disabled");
		}
	}
}

// ─── Gradient 过渡 ─────────────────────────────────────────────

export function getDefaultGradientEnabled(): boolean {
	const gradientConfig = backgroundWallpaper.banner?.gradient?.enable;
	if (typeof gradientConfig === "object") {
		const isMobile =
			typeof window !== "undefined" ? window.innerWidth < 768 : false;
		return isMobile
			? (gradientConfig.mobile ?? true)
			: (gradientConfig.desktop ?? true);
	}
	return gradientConfig ?? true;
}

export function getStoredGradientEnabled(): boolean {
	if (typeof window === "undefined") return getDefaultGradientEnabled();
	return settings().getTyped("gradientEnabled", getDefaultGradientEnabled());
}

export function setGradientEnabled(enabled: boolean): void {
	if (typeof window === "undefined") return;
	settings().set("gradientEnabled", String(enabled));
	applyGradientEnabledToDocument(enabled);
}

export function applyGradientEnabledToDocument(enabled: boolean): void {
	if (typeof document === "undefined") return;
	document.documentElement.setAttribute("data-gradient-enabled", String(enabled));
	const gradientElement = document.getElementById("wallpaper-gradient");
	if (gradientElement) {
		if (enabled) {
			gradientElement.style.display = "";
			gradientElement.classList.remove("gradient-disabled");
		} else {
			gradientElement.style.display = "none";
			gradientElement.classList.add("gradient-disabled");
		}
	}
}

// ─── Sakura 特效（已移除）────────────────────────────────────

export function getDefaultSakuraEnabled(): boolean { return false; }
export function getStoredSakuraEnabled(): boolean { return false; }
export function setSakuraEnabled(_enabled: boolean): void {}

// ─── Banner 标题 ──────────────────────────────────────────────

export function getDefaultBannerTitleEnabled(): boolean {
	return backgroundWallpaper.common?.homeText?.enable ?? true;
}

export function getDefaultBannerCarouselEnabled(): boolean {
	return backgroundWallpaper.common?.carousel?.enable ?? false;
}

export function getStoredBannerTitleEnabled(): boolean {
	if (typeof window === "undefined") return getDefaultBannerTitleEnabled();
	return settings().getTyped("bannerTitleEnabled", getDefaultBannerTitleEnabled());
}

export function getStoredBannerCarouselEnabled(): boolean {
	const isSwitchable = displaySettingsConfig.bannerCarouselSwitchable;
	if (!isSwitchable) return getDefaultBannerCarouselEnabled();
	if (typeof window === "undefined") return getDefaultBannerCarouselEnabled();
	return settings().getTyped("bannerCarouselEnabled", getDefaultBannerCarouselEnabled());
}

export function setBannerTitleEnabled(enabled: boolean): void {
	if (typeof window === "undefined") return;
	settings().set("bannerTitleEnabled", String(enabled));
	applyBannerTitleEnabledToDocument(enabled);
}

export function setBannerCarouselEnabled(enabled: boolean): void {
	const safeEnabled = !!enabled;
	const isSwitchable = displaySettingsConfig.bannerCarouselSwitchable;
	if (isSwitchable && typeof window !== "undefined") {
		settings().set("bannerCarouselEnabled", String(safeEnabled));
	}
	applyBannerCarouselEnabledToDocument(safeEnabled);
	if (typeof window !== "undefined") {
		window.dispatchEvent(
			new CustomEvent("bannerCarouselChange", {
				detail: { enabled: safeEnabled },
			}),
		);
	}
}

export function applyBannerTitleEnabledToDocument(enabled: boolean): void {
	if (typeof document === "undefined") return;
	document.documentElement.setAttribute(
		"data-banner-title-enabled",
		String(enabled),
	);
	const bannerTextOverlay = document.querySelector(
		".banner-home-text-overlay",
	) as HTMLElement;
	if (bannerTextOverlay) {
		if (enabled) {
			bannerTextOverlay.classList.remove("user-hidden");
		} else {
			bannerTextOverlay.classList.add("user-hidden");
		}
	}
}

export function applyBannerCarouselEnabledToDocument(enabled: boolean): void {
	if (typeof document === "undefined") return;
	document.documentElement.setAttribute(
		"data-banner-carousel-enabled",
		String(enabled),
	);
}

// ─── 卡片边框 ─────────────────────────────────────────────────

export function getDefaultCardBorderEnabled(): boolean {
	return siteConfig.card?.border ?? false;
}

export function getStoredCardBorderEnabled(): boolean {
	if (typeof window === "undefined") return getDefaultCardBorderEnabled();
	return settings().getTyped("cardBorderEnabled", getDefaultCardBorderEnabled());
}

export function setCardBorderEnabled(enabled: boolean): void {
	if (typeof window === "undefined") return;
	settings().set("cardBorderEnabled", String(enabled));
	if (enabled) {
		document.documentElement.classList.add("enable-card-border");
	} else {
		document.documentElement.classList.remove("enable-card-border");
	}
}

// ─── 卡片跟随主题 ─────────────────────────────────────────────

export function getDefaultCardFollowThemeEnabled(): boolean {
	return siteConfig.card?.followTheme ?? false;
}

export function getStoredCardFollowThemeEnabled(): boolean {
	if (typeof window === "undefined") return getDefaultCardFollowThemeEnabled();
	return settings().getTyped("cardFollowThemeEnabled", getDefaultCardFollowThemeEnabled());
}

export function setCardFollowThemeEnabled(enabled: boolean): void {
	if (typeof window === "undefined") return;
	settings().set("cardFollowThemeEnabled", String(enabled));
	if (enabled) {
		document.body.classList.add("card-follow-theme-hue");
	} else {
		document.body.classList.remove("card-follow-theme-hue");
	}
}
