import JSZip from 'jszip';

/**
 * exceljs cannot draw charts, so native (editable) Excel charts are added to
 * the finished workbook by writing the OOXML parts and wiring them into the
 * zip. Sheet N of the workbook is `xl/worksheets/sheetN.xml` (exceljs numbers
 * them in creation order).
 */

export type ChartKind = 'column' | 'bar' | 'pie';

export interface ChartSeries {
  name: string;
  values: number[];
  /** `#RRGGBB`. Pie charts colour each slice from `ChartSpec.sliceColors`. */
  color: string;
}

export interface ChartSpec {
  /** 1-based position of the sheet that holds the data and the chart. */
  sheet: number;
  sheetName: string;
  kind: ChartKind;
  title: string;
  categories: string[];
  /** First data row of the category column and its letter, e.g. `A`, `2`. */
  categoryColumn: string;
  firstRow: number;
  /** One column letter per series; the series name is in the row above `firstRow`. */
  seriesColumns: string[];
  series: ChartSeries[];
  sliceColors?: string[];
  /** Top-left cell (0-based) and size in cells. */
  anchor: { col: number; row: number; cols: number; rows: number };
}

const NS_C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_XDR =
  'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const REL_DRAWING = `${NS_R}/drawing`;
const REL_CHART = `${NS_R}/chart`;
const CT_DRAWING = 'application/vnd.openxmlformats-officedocument.drawing+xml';
const CT_CHART =
  'application/vnd.openxmlformats-officedocument.drawingml.chart+xml';

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const escapeXml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const quoteSheet = (name: string) => `'${name.replace(/'/g, "''")}'`;

const fill = (color: string) =>
  `<a:solidFill><a:srgbClr val="${color.replace('#', '')}"/></a:solidFill>`;

function strCache(values: string[]): string {
  const points = values
    .map((v, i) => `<c:pt idx="${i}"><c:v>${escapeXml(v)}</c:v></c:pt>`)
    .join('');
  return `<c:strCache><c:ptCount val="${values.length}"/>${points}</c:strCache>`;
}

function numCache(values: number[]): string {
  const points = values
    .map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`)
    .join('');
  return `<c:numCache><c:formatCode>#,##0</c:formatCode><c:ptCount val="${values.length}"/>${points}</c:numCache>`;
}

function seriesXml(spec: ChartSpec, index: number): string {
  const s = spec.series[index];
  const sheet = quoteSheet(spec.sheetName);
  const last = spec.firstRow + spec.categories.length - 1;
  const col = spec.seriesColumns[index];
  const cat = `${sheet}!$${spec.categoryColumn}$${spec.firstRow}:$${spec.categoryColumn}$${last}`;
  const val = `${sheet}!$${col}$${spec.firstRow}:$${col}$${last}`;
  const name = `${sheet}!$${col}$${spec.firstRow - 1}`;

  const points =
    spec.kind === 'pie'
      ? (spec.sliceColors ?? [])
          .slice(0, spec.categories.length)
          .map(
            (c, i) =>
              `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr>${fill(c)}</c:spPr></c:dPt>`,
          )
          .join('')
      : '';
  const labels =
    spec.kind === 'pie'
      ? '<c:dLbls><c:numFmt formatCode="0%" sourceLinked="0"/><c:spPr><a:noFill/></c:spPr><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/><c:showLeaderLines val="1"/></c:dLbls>'
      : '';

  return (
    `<c:ser><c:idx val="${index}"/><c:order val="${index}"/>` +
    `<c:tx><c:strRef><c:f>${escapeXml(name)}</c:f>${strCache([s.name])}</c:strRef></c:tx>` +
    (spec.kind === 'pie' ? '' : `<c:spPr>${fill(s.color)}</c:spPr>`) +
    (spec.kind === 'pie' ? '' : '<c:invertIfNegative val="0"/>') +
    points +
    labels +
    `<c:cat><c:strRef><c:f>${escapeXml(cat)}</c:f>${strCache(spec.categories)}</c:strRef></c:cat>` +
    `<c:val><c:numRef><c:f>${escapeXml(val)}</c:f>${numCache(s.values)}</c:numRef></c:val>` +
    '</c:ser>'
  );
}

function plotXml(spec: ChartSpec): string {
  const series = spec.series.map((_, i) => seriesXml(spec, i)).join('');
  if (spec.kind === 'pie') {
    return `<c:pieChart><c:varyColors val="1"/>${series}<c:firstSliceAng val="0"/></c:pieChart>`;
  }
  const dir = spec.kind === 'bar' ? 'bar' : 'col';
  const catPos = spec.kind === 'bar' ? 'l' : 'b';
  const valPos = spec.kind === 'bar' ? 'b' : 'l';
  return (
    `<c:barChart><c:barDir val="${dir}"/><c:grouping val="clustered"/><c:varyColors val="0"/>${series}` +
    '<c:gapWidth val="80"/><c:axId val="111111111"/><c:axId val="222222222"/></c:barChart>' +
    `<c:catAx><c:axId val="111111111"/><c:scaling><c:orientation val="${spec.kind === 'bar' ? 'maxMin' : 'minMax'}"/></c:scaling><c:delete val="0"/><c:axPos val="${catPos}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="222222222"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>` +
    `<c:valAx><c:axId val="222222222"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${valPos}"/><c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="#,##0" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="111111111"/><c:crosses val="${spec.kind === 'bar' ? 'max' : 'autoZero'}"/><c:crossBetween val="between"/></c:valAx>`
  );
}

export function chartXml(spec: ChartSpec): string {
  const legend =
    spec.kind === 'pie' || spec.series.length > 1
      ? `<c:legend><c:legendPos val="${spec.kind === 'pie' ? 'r' : 'b'}"/><c:overlay val="0"/></c:legend>`
      : '';
  return (
    XML_HEADER +
    `<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}">` +
    '<c:roundedCorners val="0"/><c:chart>' +
    `<c:title><c:tx><c:rich><a:bodyPr/><a:p><a:pPr><a:defRPr sz="1200" b="1"/></a:pPr><a:r><a:rPr lang="vi-VN" sz="1200" b="1"/><a:t>${escapeXml(spec.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>` +
    `<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${plotXml(spec)}</c:plotArea>` +
    `${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`
  );
}

function anchorXml(spec: ChartSpec, rId: string, id: number): string {
  const { col, row, cols, rows } = spec.anchor;
  return (
    '<xdr:twoCellAnchor>' +
    `<xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
    `<xdr:to><xdr:col>${col + cols}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row + rows}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
    `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${id}" name="Chart ${id}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>` +
    '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>' +
    `<a:graphic><a:graphicData uri="${NS_C}"><c:chart xmlns:c="${NS_C}" xmlns:r="${NS_R}" r:id="${rId}"/></a:graphicData></a:graphic>` +
    '</xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>'
  );
}

const relationships = (items: { id: string; type: string; target: string }[]) =>
  XML_HEADER +
  `<Relationships xmlns="${NS_PKG_REL}">` +
  items
    .map(
      (r) =>
        `<Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"/>`,
    )
    .join('') +
  '</Relationships>';

/** Returns the workbook with `charts` drawn on their sheets. */
export async function addCharts(
  workbook: Buffer,
  charts: ChartSpec[],
): Promise<Buffer> {
  if (charts.length === 0) return workbook;
  const zip = await JSZip.loadAsync(workbook);

  const overrides: string[] = [];
  const sheets = [...new Set(charts.map((c) => c.sheet))];
  let chartNo = 0;

  for (const sheet of sheets) {
    const onSheet = charts.filter((c) => c.sheet === sheet);
    const drawingPath = `xl/drawings/drawing${sheet}.xml`;
    const drawingRels: { id: string; type: string; target: string }[] = [];
    const anchors: string[] = [];

    for (const spec of onSheet) {
      chartNo += 1;
      zip.file(`xl/charts/chart${chartNo}.xml`, chartXml(spec));
      overrides.push(
        `<Override PartName="/xl/charts/chart${chartNo}.xml" ContentType="${CT_CHART}"/>`,
      );
      const rId = `rId${drawingRels.length + 1}`;
      drawingRels.push({
        id: rId,
        type: REL_CHART,
        target: `../charts/chart${chartNo}.xml`,
      });
      anchors.push(anchorXml(spec, rId, chartNo + 1));
    }

    zip.file(
      drawingPath,
      XML_HEADER +
        `<xdr:wsDr xmlns:xdr="${NS_XDR}" xmlns:a="${NS_A}">${anchors.join('')}</xdr:wsDr>`,
    );
    zip.file(
      `xl/drawings/_rels/drawing${sheet}.xml.rels`,
      relationships(drawingRels),
    );
    overrides.push(
      `<Override PartName="/${drawingPath}" ContentType="${CT_DRAWING}"/>`,
    );

    await linkDrawing(zip, sheet);
  }

  const typesFile = zip.file('[Content_Types].xml');
  if (!typesFile) throw new Error('Workbook is missing [Content_Types].xml');
  const types = await typesFile.async('string');
  zip.file(
    '[Content_Types].xml',
    types.replace('</Types>', `${overrides.join('')}</Types>`),
  );

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/** Adds the `<drawing>` element and its relationship to `sheetN.xml`. */
async function linkDrawing(zip: JSZip, sheet: number): Promise<void> {
  const sheetPath = `xl/worksheets/sheet${sheet}.xml`;
  const relsPath = `xl/worksheets/_rels/sheet${sheet}.xml.rels`;
  const sheetFile = zip.file(sheetPath);
  if (!sheetFile) throw new Error(`Workbook has no ${sheetPath}`);
  let xml = await sheetFile.async('string');

  const existing = zip.file(relsPath);
  let rels = existing ? await existing.async('string') : null;
  const rId = 'rIdFinanceDrawing';
  const relationship = `<Relationship Id="${rId}" Type="${REL_DRAWING}" Target="../drawings/drawing${sheet}.xml"/>`;
  rels = rels
    ? rels.replace('</Relationships>', `${relationship}</Relationships>`)
    : `${XML_HEADER}<Relationships xmlns="${NS_PKG_REL}">${relationship}</Relationships>`;
  zip.file(relsPath, rels);

  if (!xml.includes('xmlns:r=')) {
    xml = xml.replace('<worksheet ', `<worksheet xmlns:r="${NS_R}" `);
  }
  const element = `<drawing r:id="${rId}"/>`;
  // Schema order: ... pageMargins, pageSetup, headerFooter, drawing, legacyDrawing, tableParts.
  const after = ['<legacyDrawing', '<tableParts', '<extLst', '</worksheet>'];
  const marker = after.find((tag) => xml.includes(tag))!;
  zip.file(sheetPath, xml.replace(marker, `${element}${marker}`));
}
