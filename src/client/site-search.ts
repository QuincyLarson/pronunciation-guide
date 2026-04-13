function normalizeToSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function attachGlobalSearchForms(): void {
  const forms = document.querySelectorAll<HTMLFormElement>("[data-site-search-form]");

  for (const form of forms) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = form.querySelector<HTMLInputElement>('input[name="q"]');
      const query = input?.value ?? "";
      const slug = normalizeToSlug(query);

      if (!slug) {
        input?.focus();
        return;
      }

      window.location.href = `/w/${encodeURIComponent(slug)}`;
    });
  }
}

function attachBrowseSearch(): void {
  const searchInput = document.querySelector<HTMLInputElement>("[data-browse-search]");
  if (!searchInput) {
    return;
  }

  const entries = [...document.querySelectorAll<HTMLElement>("[data-browse-entry]")];
  const groups = [...document.querySelectorAll<HTMLElement>("[data-browse-group]")];

  const applyFilter = (rawValue: string) => {
    const term = rawValue.trim().toLowerCase();

    for (const entry of entries) {
      const haystack = (entry.dataset.searchText ?? "").toLowerCase();
      entry.hidden = term.length > 0 && !haystack.includes(term);
    }

    for (const group of groups) {
      const visibleEntry = group.querySelector("[data-browse-entry]:not([hidden])");
      group.hidden = !visibleEntry;
    }
  };

  searchInput.addEventListener("input", () => {
    applyFilter(searchInput.value);
  });

  const initialQ = new URL(window.location.href).searchParams.get("q") ?? "";
  if (initialQ) {
    searchInput.value = initialQ;
  }

  applyFilter(searchInput.value);
}

attachGlobalSearchForms();
attachBrowseSearch();
