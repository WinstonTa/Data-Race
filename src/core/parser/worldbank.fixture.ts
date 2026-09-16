/**
 * Trimmed copy of the World Bank "API_*" CSV layout: a two-line preamble
 * (with blank lines between), four text columns, year columns, a trailing
 * empty column from the final comma, a row with no data, and a region
 * aggregate mixed in with countries.
 */
export const WORLD_BANK_CSV = [
  '\uFEFF"Data Source","World Development Indicators",',
  "",
  '"Last Updated Date","2026-07-13",',
  "",
  '"Country Name","Country Code","Indicator Name","Indicator Code","1960","1961","1962","1963","1964","1965",',
  '"Aruba","ABW","GDP (current US$)","NY.GDP.MKTP.CD","","","","405586592.178771","487709497.206704","596648044.692737",',
  '"Africa Eastern and Southern","AFE","GDP (current US$)","NY.GDP.MKTP.CD","24205729121.3343","24958927693.8095","27073279052.5749","31769188044.0148","30279603755.3047","33806233152.8526",',
  '"Afghanistan","AFG","GDP (current US$)","NY.GDP.MKTP.CD","537777811.111111","548888895.555556","546666677.777778","751111191.111111","800000044.444444","1006666637.77778",',
  '"Gibraltar","GIB","GDP (current US$)","NY.GDP.MKTP.CD","","","","","","",',
  '"Angola","AGO","GDP (current US$)","NY.GDP.MKTP.CD","","","","","","",',
  '"Albania","ALB","GDP (current US$)","NY.GDP.MKTP.CD","","","","","","1235620000",',
  '"Andorra","AND","GDP (current US$)","NY.GDP.MKTP.CD","","","","","","",',
  '"United Arab Emirates","ARE","GDP (current US$)","NY.GDP.MKTP.CD","","","","","","",',
  '"Argentina","ARG","GDP (current US$)","NY.GDP.MKTP.CD","","","24450604877.8404","18272123664.1221","25605249551.6871","28344705967.4211",',
].join("\r\n");
