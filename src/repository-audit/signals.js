// Input is already extracted prose: fenced/inline/HTML code and comments omitted.
export function placeholderFindings(prose, headings = "") {
  const text = `${headings}\n${prose}`,
    findings = [];
  if (/\bTODO\b/.test(text))
    findings.push(
      "Possible unresolved TODO in README prose; review whether it is intentional.",
    );
  if (/\byour-project-name\b/i.test(text))
    findings.push("Possible template placeholder: your-project-name.");
  if (
    /bootstrapped with Create React App/i.test(prose) &&
    /Available Scripts|Learn More/i.test(headings)
  )
    findings.push(
      "Create React App starter text remains; check whether project-specific instructions are needed.",
    );
  if (
    /This template provides a minimal setup to get React working in Vite/i.test(
      prose,
    ) &&
    /Expanding the ESLint configuration|official plugins/i.test(text)
  )
    findings.push(
      "Vite starter text remains; check whether project-specific instructions are needed.",
    );
  if (
    /This is a Next\.js project bootstrapped with/i.test(prose) &&
    /Deploy on Vercel/i.test(headings)
  )
    findings.push(
      "Next.js starter text remains; check whether project-specific instructions are needed.",
    );
  return findings;
}

export function historyFindings(updated, commits, now = Date.now()) {
  const date = Date.parse(updated),
    day = 86400000;
  if (!Number.isFinite(date) || date > now || now - date < 90 * day) return [];
  const recent = new Map(
    commits
      .filter((c) => typeof c.sha === "string" && c.sha)
      .map((c) => [c.sha, Date.parse(c.commit?.committer?.date)]),
  );
  const dates = [...recent.values()].filter(
    (d) => Number.isFinite(d) && d > date && d <= now && now - d <= 30 * day,
  );
  if (dates.length < 10 || Math.max(...dates) - Math.min(...dates) < 7 * day)
    return [];
  return [
    `README may need review — repository has significant activity after the last observed README update. Last observed update: ${new Date(date).toISOString().slice(0, 10)}; ${dates.length} distinct recent commits span at least seven days. Commit activity does not prove documentation is outdated.`,
  ];
}
