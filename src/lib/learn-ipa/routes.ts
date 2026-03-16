export const LEARN_IPA_ROOT_PATH = "/learn-ipa/";
export const LEARN_IPA_REFERENCE_PATH = "/learn-ipa/reference/";
export const LEARN_IPA_ABOUT_PATH = "/learn-ipa/about/";

export function getLearnIpaModulePath(slug: string): string {
  return `/learn-ipa/module/${encodeURIComponent(slug)}/`;
}

export function getLearnIpaAppPath(params?: {
  stepId?: string | null;
  moduleId?: string | null;
  view?: "overview" | "progress" | null;
}): string {
  const url = new URL(LEARN_IPA_ROOT_PATH, "https://example.com");

  if (params?.stepId) {
    url.searchParams.set("step", params.stepId);
  }

  if (params?.moduleId) {
    url.searchParams.set("module", params.moduleId);
  }

  if (params?.view && params.view !== "overview") {
    url.searchParams.set("view", params.view);
  }

  const search = url.searchParams.toString();
  return `${LEARN_IPA_ROOT_PATH}${search ? `?${search}` : ""}`;
}
