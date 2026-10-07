/**
 * LFB-Online Fortbildungsdarstellung für Moodle
 * 
 * Rendert die aggregierten Fortbildungsdaten aus zielinfos.json
 * in ein responsives, Moodle-kompatibles HTML mit Filter- und Link-Sharing-Funktionen.
 */

let fortbildungData = null;

/**
 * XSS-Schutz: Maskiert potenziell gefährliche HTML-Zeichen
 */
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Lädt die JSON-Datei asynchron mit Fehlerbehandlung und Caching
 */
async function loadJSON(url) {
    if (fortbildungData == null) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            fortbildungData = await response.json();
        } catch (err) {
            console.error('[LFB] Fehler beim Laden der JSON-Daten:', err);
            const container = document.getElementById('fortbildungen-container');
            if (container) {
                container.innerHTML = `<div class="alert alert-danger" role="alert">
                    Die Fortbildungsdaten konnten leider nicht geladen werden. Bitte versuchen Sie es später erneut.
                </div>`;
            }
            throw err;
        }
    }
    return fortbildungData;
}

/**
 * Robustes Parsen von Datumsstrings (vermeidet UTC-Verschiebungen bei reinen Datumswerten)
 */
function parseLocalDate(dateString) {
    if (!dateString) return null;
    // Format YYYY-MM-DD direkt ohne Timezone-Glitch extrahieren
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        const day = parseInt(match[3], 10);
        return new Date(year, month, day);
    }
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Formatiert ein Datum in numerisches deutsches Format (z. B. "17.09.2026")
 */
function formatDate(dateString) {
    const date = parseLocalDate(dateString);
    if (!date) return escapeHTML(dateString || '');

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

/**
 * Ermittelt den Anzeigetext für einen Termin (inkl. Behandlung von Dummy-Daten wie 31.12.)
 */
function getTerminText(termin) {
    if (!termin) return '';
    const date = parseLocalDate(termin);
    if (!date) return escapeHTML(termin);

    const tag = date.getDate();
    const monat = date.getMonth() + 1;

    // Fiktiver Platzhaltertermin für Dauer-/Abrufangebote
    if (tag === 31 && monat === 12) {
        return 'n. Absprache';
    }

    return formatDate(termin);
}

/**
 * Prüft, ob ein Termin zeitlich in der Zukunft liegt oder ein aktives Dauerangebot ist
 */
function isTerminActive(termin, today, isAbrufangebot = false) {
    // Abrufangebote ("nach Absprache" oder ohne fixen Termin) sind immer aktiv
    if (isAbrufangebot || termin.dauer === 'n. Absprache' || termin.dauer === 'nach Absprache') {
        return true;
    }

    const ersterTerminDate = parseLocalDate(termin.erster_termin);
    if (ersterTerminDate) {
        // Dummy 31.12. zählt als Dauerangebot
        if (ersterTerminDate.getDate() === 31 && (ersterTerminDate.getMonth() + 1) === 12) {
            return true;
        }
        if (ersterTerminDate >= today) {
            return true;
        }
    }

    // Prüfe Folgetermine in der Reihe
    if (Array.isArray(termin.reihe_je_termin)) {
        for (const reihe of termin.reihe_je_termin) {
            const rDate = parseLocalDate(reihe.termin);
            if (rDate && rDate >= today) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Formatiert die Ortsangabe und stellt "online" bei vorhandenem BBB-/Webex-Link als anklickbaren Link dar
 */
function formatOrtCell(ort, link) {
    if (!ort || ort === '–') return '<span class="text-muted">–</span>';
    if (typeof ort === 'string' && ort.includes('<a ')) {
        return ort;
    }
    const escaped = escapeHTML(ort);
    if (ort.toLowerCase() === 'online' && link) {
        return `<a href="${escapeHTML(link)}" target="_blank" rel="noopener noreferrer" style="text-decoration: underline; font-weight: bold;" title="Online-Konferenzraum öffnen">${escaped}</a>`;
    }
    return escaped;
}

/**
 * Hauptfunktion: Erzeugt das HTML aus der JSON-Datenstruktur
 */
function generateHTMLFromJSON(jsonData, selectedAnbieter = '', selectedOrt = '', selectedTag = '', showCompleted = false, searchQuery = '') {
    if (!jsonData) {
        return '';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const normSearch = (searchQuery || '').trim().toLowerCase();

    // Fortbildungen: Zentral und regional nicht mehr trennen, sondern gemeinsam anzeigen
    const alleFortbildungen = [
        ...(jsonData.fortbildungen || []),
        ...((!jsonData.fortbildungen && jsonData.zentraleFortbildungen) ? jsonData.zentraleFortbildungen : []),
        ...((!jsonData.fortbildungen && jsonData.regionaleFortbildungen) ? jsonData.regionaleFortbildungen : [])
    ];
    const uniqueFortbildungen = [];
    const seenTitles = new Set();
    for (const item of alleFortbildungen) {
        if (!seenTitles.has(item.titel)) {
            seenTitles.add(item.titel);
            uniqueFortbildungen.push(item);
        }
    }
    uniqueFortbildungen.sort((a, b) => a.titel.localeCompare(b.titel, 'de'));

    const groupedData = {
        "Fortbildungen": {
            id: 'zsl-fortbildungen',
            isAbruf: false,
            data: uniqueFortbildungen
        },
        "Abrufangebote": {
            id: 'zsl-intern',
            isAbruf: true,
            data: jsonData.abrufangebote || []
        },
        "Individuelle Angebote": {
            id: 'zsl-individuell',
            isAbruf: true,
            data: jsonData.individuell || []
        }
    };

    let html = `
    <style>
    .lfb-desc-wrapper {
        margin-bottom: 0.85rem;
    }
    .lfb-desc-text {
        line-height: 1.6;
        color: #4a5568;
        font-size: 0.95rem;
        white-space: pre-line;
        margin-bottom: 0;
        transition: color 0.15s ease;
    }
    .lfb-desc-text.has-toggle {
        cursor: pointer;
    }
    .lfb-desc-text.collapsed {
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .lfb-desc-text.expanded {
        display: block;
    }
    .lfb-desc-action {
        margin-top: 4px;
        min-height: 20px;
    }
    .lfb-desc-toggle {
        background: none;
        border: none;
        padding: 0;
        color: #2b6cb0;
        font-size: 0.86rem;
        font-weight: 600;
        cursor: pointer;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 3px;
        line-height: 1.4;
    }
    .lfb-desc-toggle:hover {
        color: #1a4971;
        text-decoration: underline;
    }
    </style>
    `;
    let totalRendered = 0;
    let descCounter = 0;

    for (const [typ, gruppe] of Object.entries(groupedData)) {
        if (!gruppe.data || gruppe.data.length === 0) continue;

        let categoryHtml = '';

        gruppe.data.forEach(fortbildung => {
            const tags = Array.isArray(fortbildung.tags) ? fortbildung.tags : [];
            const termine = Array.isArray(fortbildung.termine) ? fortbildung.termine : [];

            // 1. Tag-Filter
            if (selectedTag !== '' && !tags.includes(selectedTag)) {
                return;
            }

            // 2. Volltextsuche (optional)
            if (normSearch !== '') {
                const searchCorpus = `${fortbildung.titel || ''} ${fortbildung.kurzbeschreibung?.text || ''} ${tags.join(' ')} ${termine.map(t => `${t.tnr || ''} ${t.thema || ''} ${t.ort || ''}`).join(' ')}`.toLowerCase();
                if (!searchCorpus.includes(normSearch)) {
                    return;
                }
            }

            // 3. Termine nach Anbieter, Ort und Gültigkeit filtern
            const matchedTermine = termine.filter(termin => {
                const anbieterMatch = (selectedAnbieter === '' || termin.anbieter === selectedAnbieter || termin.anbieter === '');
                const ortMatch = (selectedOrt === '' || termin.ort === selectedOrt ||
                    (Array.isArray(termin.reihe_je_termin) && termin.reihe_je_termin.some(r => r.ort === selectedOrt)));

                if (!anbieterMatch || !ortMatch) return false;

                // Vergangenheitsprüfung
                if (showCompleted) return true;
                return isTerminActive(termin, today, gruppe.isAbruf);
            });

            // Wenn Termine existieren, aber keiner den Filtern entspricht -> Fortbildung überspringen
            if (termine.length > 0 && matchedTermine.length === 0) {
                return;
            }

            // Wenn keine Termine vorhanden sind (z. B. reine Beratungsangebote)
            if (termine.length === 0) {
                if (selectedAnbieter !== '' || selectedOrt !== '') {
                    return; // Reines Beratungsangebot passt nicht zu konkretem Ort/Anbieter
                }
            }

            totalRendered++;

            // HTML für dieses Fortbildungsthema rendern
            categoryHtml += `<div class="lfb-thema card mb-4 shadow-sm border-0" style="margin-top: 1.5rem; border-radius: 8px; background: #fff;">`;
            categoryHtml += `<div class="card-body p-4">`;

            // Titel
            categoryHtml += `<h4 class="card-title text-dark" style="margin-bottom: 1rem; font-weight: 700; color: #1e293b;">${escapeHTML(fortbildung.titel)}</h4>`;

            // Kurzbeschreibung & Bild (Responsives Flex-Layout mit automatischem Zeilenumbruch auf Mobile)
            categoryHtml += `<div class="lfb-content-row d-flex flex-wrap align-items-start" style="display: flex; flex-wrap: wrap; align-items: flex-start; gap: 20px;">`;

            categoryHtml += `<div class="lfb-text-col" style="flex: 1 1 300px; min-width: 250px;">`;
            if (fortbildung.kurzbeschreibung?.text) {
                descCounter++;
                const descId = `lfb-desc-${descCounter}`;
                categoryHtml += `
                    <div class="lfb-desc-wrapper">
                        <div class="lfb-desc-text collapsed" id="${descId}" title="Klicken zum Auf- oder Zuklappen">${escapeHTML(fortbildung.kurzbeschreibung.text)}</div>
                        <div class="lfb-desc-action">
                            <button type="button" class="lfb-desc-toggle" data-target="${descId}" style="display: none;">mehr ▾</button>
                        </div>
                    </div>
                `;
            }
            if (fortbildung.kurzbeschreibung?.link) {
                categoryHtml += `<p class="mb-2"><a href="${escapeHTML(fortbildung.kurzbeschreibung.link)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-primary">${escapeHTML(fortbildung.kurzbeschreibung.link)}</a></p>`;
            }
            categoryHtml += `</div>`;

            if (fortbildung.kurzbeschreibung?.bild) {
                categoryHtml += `<div class="lfb-image-col" style="flex: 0 0 auto;">`;
                categoryHtml += `<img src="${escapeHTML(fortbildung.kurzbeschreibung.bild)}" class="img-thumbnail rounded" style="max-width: 140px; max-height: 140px; object-fit: cover;" alt="Abbildung zu ${escapeHTML(fortbildung.titel)}">`;
                categoryHtml += `</div>`;
            }

            categoryHtml += `</div>`; // .lfb-content-row

            // Tags als Badges
            if (tags.length > 0) {
                categoryHtml += `<div class="lfb-tags mt-3 mb-3" style="margin-top: 0.75rem; margin-bottom: 1rem;">`;
                categoryHtml += `<strong style="font-size: 0.85rem; color: #6c757d; margin-right: 6px;">Tags:</strong> `;
                tags.forEach(tag => {
                    categoryHtml += `<span class="badge badge-secondary bg-light text-dark border mr-1 mb-1" style="display: inline-block; padding: 4px 8px; font-size: 0.8rem; border-radius: 4px; margin-right: 4px; margin-bottom: 4px;">${escapeHTML(tag)}</span>`;
                });
                categoryHtml += `</div>`;
            }

            // Termintabelle
            if (matchedTermine.length > 0) {
                const hasAnbieter = matchedTermine.some(t => t.anbieter && t.anbieter.trim() && t.anbieter !== '–');

                categoryHtml += `<div class="table-responsive mt-3" style="overflow-x: auto;">`;
                categoryHtml += `<table class="table table-sm table-hover lfb" style="width: 100%; margin-bottom: 0; font-size: 0.92rem;">`;
                categoryHtml += `<thead class="thead-light bg-light">
                                    <tr>
                                        ${hasAnbieter ? '<th class="lfb-anbieter" style="padding: 8px; white-space: nowrap;">Region</th>' : ''}
                                        <th class="lfb-tnr" style="padding: 8px; white-space: nowrap;">LFB</th>
                                        <th class="lfb-erster-termin" style="padding: 8px;">Datum</th>
                                        <th class="lfb-dauer" style="padding: 8px; white-space: nowrap;">Dauer</th>
                                        <th class="lfb-ort" style="padding: 8px; white-space: nowrap;">Ort</th>
                                    </tr>
                                 </thead>
                                 <tbody>`;

                matchedTermine.forEach(termin => {
                    const hasDirectVikoLink = Boolean(termin.online_link || (termin.ort && termin.ort.toLowerCase() === 'online' && (termin.link || termin.online_link)));

                    let tnrLink = '<span class="text-muted">–</span>';
                    if (termin.tnr) {
                        if (hasDirectVikoLink) {
                            tnrLink = `<span class="text-muted" style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-weight: 500; letter-spacing: 0.5px;" title="Direkter Zugang über Konferenzraum (Spalte Ort)">${escapeHTML(termin.tnr)}</span>`;
                        } else {
                            tnrLink = `<a href="https://lfbo.kultus-bw.de/lfb/termine/${encodeURIComponent(termin.tnr)}" target="_blank" rel="noopener noreferrer" style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-weight: 600; text-decoration: underline; letter-spacing: 0.5px;" title="In LFB-Online öffnen">${escapeHTML(termin.tnr)}</a>`;
                        }
                    }

                    categoryHtml += `<tr>
                        ${hasAnbieter ? `<td class="lfb-anbieter align-top" style="padding: 8px; vertical-align: top; white-space: nowrap;">${escapeHTML(termin.anbieter || '–')}</td>` : ''}
                        <td class="lfb-tnr align-top" style="padding: 8px; vertical-align: top; white-space: nowrap;">${tnrLink}</td>
                        <td class="lfb-erster-termin align-top" style="padding: 8px; vertical-align: top;">
                            <div><span style="font-weight: 600; white-space: nowrap;">${getTerminText(termin.erster_termin)}</span>${termin.thema ? ` <span style="font-weight: 500; color: #2d3748;">– ${escapeHTML(termin.thema)}</span>` : ''}</div>`;

                    // Folgetermine strukturiert auflisten
                    if (Array.isArray(termin.reihe_je_termin) && termin.reihe_je_termin.length > 0) {
                        termin.reihe_je_termin.forEach((reihe, idx) => {
                            const rDate = parseLocalDate(reihe.termin);
                            if (showCompleted || (rDate && rDate >= today)) {
                                categoryHtml += `<div style="font-size: 0.85rem; color: #555; margin-top: 2px;">
                                    <span class="text-muted">Folgetermin ${idx + 1}:</span> <span style="white-space: nowrap;">${formatDate(reihe.termin)}</span>
                                </div>`;
                            }
                        });
                    }
                    categoryHtml += `</td>`;

                    // Dauer
                    categoryHtml += `<td class="lfb-dauer align-top" style="padding: 8px; vertical-align: top; white-space: nowrap;">
                        <div>${escapeHTML(termin.dauer || '–')}</div>`;
                    if (Array.isArray(termin.reihe_je_termin) && termin.reihe_je_termin.length > 0) {
                        termin.reihe_je_termin.forEach(reihe => {
                            const rDate = parseLocalDate(reihe.termin);
                            if (showCompleted || (rDate && rDate >= today)) {
                                categoryHtml += `<div style="font-size: 0.85rem; color: #555; margin-top: 2px; white-space: nowrap;">
                                    ${escapeHTML(reihe.dauer || '–')}
                                </div>`;
                            }
                        });
                    }
                    categoryHtml += `</td>`;

                    // Ort
                    categoryHtml += `<td class="lfb-ort align-top" style="padding: 8px; vertical-align: top; white-space: nowrap;">
                        <div>${formatOrtCell(termin.ort, termin.online_link || termin.link)}</div>`;
                    if (Array.isArray(termin.reihe_je_termin) && termin.reihe_je_termin.length > 0) {
                        termin.reihe_je_termin.forEach(reihe => {
                            const rDate = parseLocalDate(reihe.termin);
                            if (showCompleted || (rDate && rDate >= today)) {
                                const rLink = reihe.online_link || reihe.link || (reihe.ort?.toLowerCase() === 'online' ? (termin.online_link || termin.link) : '');
                                categoryHtml += `<div style="font-size: 0.85rem; color: #555; margin-top: 2px; white-space: nowrap;">
                                    ${formatOrtCell(reihe.ort, rLink)}
                                </div>`;
                            }
                        });
                    }
                    categoryHtml += `</td>`;

                    categoryHtml += `</tr>`;
                });

                categoryHtml += `</tbody></table></div>`; // .table-responsive
            }

            categoryHtml += `</div></div>`; // .card-body, .card
        });

        if (categoryHtml !== '') {
            html += `<div class="lfb-kategorie-block mb-5">
                <h3 id="${gruppe.id}" class="h4 text-dark border-bottom pb-2" style="margin-top: 2.5rem; margin-bottom: 1.25rem; font-weight: 700; border-bottom: 2px solid #e9ecef;">${typ}</h3>
                ${categoryHtml}
            </div>`;
        }
    }

    if (totalRendered === 0) {
        html = `<div class="alert alert-info text-center p-4 my-4" role="alert" style="background: #e7f3fe; border: 1px solid #b6d4fe; border-radius: 8px;">
            <strong>Keine Angebote gefunden.</strong><br>
            Bitte passen Sie Ihre Filtereinstellungen oder den Suchbegriff an.
        </div>`;
    }

    return html;
}

/**
 * Erzeugt einen teilbaren Direktlink mit aktuellen Filterwerten
 */
function generateLink() {
    const baseUrl = window.location.origin + window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    const aid = urlParams.get("id");
    const asection = urlParams.get("section");

    const anbieter = document.getElementById("anbieter-filter")?.value || '';
    const ort = document.getElementById("ort-filter")?.value || '';
    const tag = document.getElementById("tag-filter")?.value || '';
    const completed = document.getElementById("show-completed")?.checked || false;
    const suche = (document.getElementById("such-filter")?.value || document.getElementById("search-filter")?.value || '').trim();

    const params = new URLSearchParams();
    if (aid) params.set("id", aid);
    if (asection) params.set("section", asection);
    if (anbieter) params.set("aaanbieter", anbieter);
    if (ort) params.set("aaort", ort);
    if (tag) params.set("aatag", tag);
    if (completed) params.set("aacompleted", "1");
    if (suche) params.set("aasuche", suche);

    const queryString = params.toString();
    const hash = document.getElementById("fortbildungsuebersicht") ? "#fortbildungsuebersicht" : (window.location.hash || '');
    const newUrl = baseUrl + (queryString ? "?" + queryString : "") + hash;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(newUrl).then(() => {
            alert("Der Direktlink wurde in die Zwischenablage kopiert:\n" + newUrl);
        }).catch(() => {
            prompt("Link kopieren:", newUrl);
        });
    } else {
        prompt("Link kopieren:", newUrl);
    }
}

/**
 * Setzt den ausgewählten Wert eines <select> Elements
 */
function setSelectValue(selectElement, value, valueSet) {
    if (selectElement && value && valueSet.has(value)) {
        selectElement.value = value;
    }
}

/**
 * Befüllt die Filter-Dropdowns dynamisch und alphabetisch sortiert
 */
function populateFilters(jsonData) {
    if (!jsonData) return;

    const anbieterSet = new Set();
    const ortSet = new Set();
    const tagSet = new Set();

    Object.values(jsonData).flat().forEach(fortbildung => {
        if (!fortbildung) return;
        if (Array.isArray(fortbildung.termine)) {
            fortbildung.termine.forEach(termin => {
                if (termin.anbieter && termin.anbieter.trim()) {
                    anbieterSet.add(termin.anbieter.trim());
                }
                if (termin.ort && termin.ort.trim()) {
                    ortSet.add(termin.ort.trim());
                }
                if (Array.isArray(termin.reihe_je_termin)) {
                    termin.reihe_je_termin.forEach(r => {
                        if (r.ort && r.ort.trim()) ortSet.add(r.ort.trim());
                    });
                }
            });
        }
        if (Array.isArray(fortbildung.tags)) {
            fortbildung.tags.forEach(tag => {
                if (tag && tag.trim()) tagSet.add(tag.trim());
            });
        }
    });

    function fillSelect(elementId, set, placeholder) {
        const select = document.getElementById(elementId);
        if (!select) return;

        // Bisherige dynamische Optionen leeren (erste Standard-Option "Alle..." erhalten falls vorhanden)
        const hasDefault = select.options.length > 0 && select.options[0].value === '';
        select.innerHTML = '';

        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.text = placeholder;
        select.add(defaultOpt);

        // Alphabetisch sortieren
        Array.from(set).sort((a, b) => a.localeCompare(b, 'de')).forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.text = val;
            select.add(opt);
        });
    }

    fillSelect('anbieter-filter', anbieterSet, 'Alle Regionen');
    fillSelect('ort-filter', ortSet, 'Alle Orte');
    fillSelect('tag-filter', tagSet, 'Alle Tags');

    // URL-Parameter auslesen und wiederherstellen
    const urlParams = new URLSearchParams(window.location.search);
    const aaanbieter = urlParams.get("aaanbieter");
    const aaort = urlParams.get("aaort");
    const aatag = urlParams.get("aatag");
    const aacompleted = urlParams.get("aacompleted");
    const aasuche = urlParams.get("aasuche");

    setSelectValue(document.getElementById('anbieter-filter'), aaanbieter, anbieterSet);
    setSelectValue(document.getElementById('ort-filter'), aaort, ortSet);
    setSelectValue(document.getElementById('tag-filter'), aatag, tagSet);

    if (aacompleted === "1" && document.getElementById('show-completed')) {
        document.getElementById('show-completed').checked = true;
    }

    if (aasuche) {
        const searchInput = document.getElementById('such-filter') || document.getElementById('search-filter');
        if (searchInput) {
            searchInput.value = aasuche;
        }
    }
}

/**
 * Wendet die aktuellen Filtereinstellungen an und aktualisiert die DOM-Ansicht
 */
async function applyFilters() {
    const selectedAnbieter = document.getElementById('anbieter-filter')?.value || '';
    const selectedOrt = document.getElementById('ort-filter')?.value || '';
    const selectedTag = document.getElementById('tag-filter')?.value || '';
    const showCompleted = document.getElementById('show-completed')?.checked || false;
    const searchQuery = document.getElementById('such-filter')?.value || document.getElementById('search-filter')?.value || '';

    const container = document.getElementById('fortbildungen-container');
    if (!container) return;

    const filteredHTML = generateHTMLFromJSON(fortbildungData, selectedAnbieter, selectedOrt, selectedTag, showCompleted, searchQuery);
    container.innerHTML = filteredHTML;
    updateDescToggles();
}

/**
 * Aktualisiert die Sichtbarkeit der "mehr"-Schaltflächen basierend auf der tatsächlichen Höhe (3 Zeilen)
 */
function updateDescToggles() {
    if (typeof document === 'undefined') return;
    requestAnimationFrame(() => {
        document.querySelectorAll('.lfb-desc-wrapper').forEach(wrapper => {
            const textEl = wrapper.querySelector('.lfb-desc-text');
            const btn = wrapper.querySelector('.lfb-desc-toggle');
            if (textEl && btn) {
                if (textEl.classList.contains('collapsed')) {
                    // Wenn der Text mehr als 3 Zeilen einnimmt, Schaltfläche anzeigen und Text als klickbar markieren
                    if (textEl.scrollHeight > textEl.clientHeight + 3) {
                        textEl.classList.add('has-toggle');
                        btn.style.display = 'inline-flex';
                        btn.textContent = 'mehr ▾';
                    } else {
                        textEl.classList.remove('has-toggle');
                        btn.style.display = 'none';
                    }
                }
            }
        });
    });
}

// Globaler Event-Listener für das Ein-/Ausklappen (Klick auf Button oder direkt auf den Text)
if (typeof window !== 'undefined' && !window.__lfbDescToggleRegistered) {
    window.__lfbDescToggleRegistered = true;
    document.addEventListener('click', function (e) {
        const toggleBtn = e.target.closest('.lfb-desc-toggle');
        const descText = e.target.closest('.lfb-desc-text.has-toggle');
        if (toggleBtn || descText) {
            const wrapper = (toggleBtn || descText).closest('.lfb-desc-wrapper');
            const descEl = wrapper?.querySelector('.lfb-desc-text');
            const btn = wrapper?.querySelector('.lfb-desc-toggle');
            if (descEl && btn && btn.style.display !== 'none') {
                e.preventDefault();
                const isCollapsed = descEl.classList.contains('collapsed');
                if (isCollapsed) {
                    descEl.classList.remove('collapsed');
                    descEl.classList.add('expanded');
                    btn.textContent = 'weniger ▴';
                } else {
                    descEl.classList.remove('expanded');
                    descEl.classList.add('collapsed');
                    btn.textContent = 'mehr ▾';
                }
            }
        }
    });
    window.addEventListener('resize', updateDescToggles);
}

/**
 * Setzt alle Filter zurück auf den Ursprungszustand
 */
function resetFilters() {
    const anbieter = document.getElementById('anbieter-filter');
    const ort = document.getElementById('ort-filter');
    const tag = document.getElementById('tag-filter');
    const completed = document.getElementById('show-completed');
    const search = document.getElementById('such-filter') || document.getElementById('search-filter');

    if (anbieter) anbieter.value = '';
    if (ort) ort.value = '';
    if (tag) tag.value = '';
    if (completed) completed.checked = false;
    if (search) search.value = '';

    applyFilters();
}

// Node.js CommonJS Export (für serverseitiges Rendering oder Tests)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        escapeHTML,
        parseLocalDate,
        formatDate,
        getTerminText,
        isTerminActive,
        formatOrtCell,
        generateHTMLFromJSON
    };
}
