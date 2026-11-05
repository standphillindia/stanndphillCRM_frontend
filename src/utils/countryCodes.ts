// src/utils/countryCodes.ts
//
// Country calling codes for phone numbers (from the team's "World Country Mobile
// Code" sheet, 195 countries). Caribbean NANP codes that the sheet showed as
// negative numbers (an Excel formula on "1-268") are written out properly here.
//
// dial  = digits after "+" (e.g. "91", "1268")
// label = how it is shown (e.g. "+91", "+1 268")
// example = a local mobile number, for the placeholder

export interface CountryCode {
  name: string;
  dial: string;
  label: string;
  example: string;
}

export const COUNTRY_CODES: CountryCode[] = [
  { name: "Afghanistan", dial: "93", label: "+93", example: "70 123 4567" },
  { name: "Albania", dial: "355", label: "+355", example: "67 212 3456" },
  { name: "Algeria", dial: "213", label: "+213", example: "551 23 45 67" },
  { name: "Andorra", dial: "376", label: "+376", example: "312 345" },
  { name: "Angola", dial: "244", label: "+244", example: "923 123 456" },
  { name: "Antigua and Barbuda", dial: "1268", label: "+1 268", example: "464 1234" },
  { name: "Argentina", dial: "54", label: "+54", example: "9 11 2345 6789" },
  { name: "Armenia", dial: "374", label: "+374", example: "77 123456" },
  { name: "Australia", dial: "61", label: "+61", example: "412 345 678" },
  { name: "Austria", dial: "43", label: "+43", example: "664 123456" },
  { name: "Azerbaijan", dial: "994", label: "+994", example: "40 123 45 67" },
  { name: "Bahamas", dial: "1242", label: "+1 242", example: "359 1234" },
  { name: "Bahrain", dial: "973", label: "+973", example: "3600 1234" },
  { name: "Bangladesh", dial: "880", label: "+880", example: "1812 345678" },
  { name: "Barbados", dial: "1246", label: "+1 246", example: "250 1234" },
  { name: "Belarus", dial: "375", label: "+375", example: "29 491 1911" },
  { name: "Belgium", dial: "32", label: "+32", example: "470 12 34 56" },
  { name: "Belize", dial: "501", label: "+501", example: "622 1234" },
  { name: "Benin", dial: "229", label: "+229", example: "01 90 01 12 34" },
  { name: "Bhutan", dial: "975", label: "+975", example: "17 12 34 56" },
  { name: "Bolivia", dial: "591", label: "+591", example: "71234567" },
  { name: "Bosnia and Herzegovina", dial: "387", label: "+387", example: "61 123 456" },
  { name: "Botswana", dial: "267", label: "+267", example: "71 123 456" },
  { name: "Brazil", dial: "55", label: "+55", example: "11 96123 4567" },
  { name: "Brunei", dial: "673", label: "+673", example: "712 3456" },
  { name: "Bulgaria", dial: "359", label: "+359", example: "87 123 4567" },
  { name: "Burkina Faso", dial: "226", label: "+226", example: "70 12 34 56" },
  { name: "Burundi", dial: "257", label: "+257", example: "79 56 12 34" },
  { name: "Cabo Verde", dial: "238", label: "+238", example: "991 12 34" },
  { name: "Cambodia", dial: "855", label: "+855", example: "91 234 567" },
  { name: "Cameroon", dial: "237", label: "+237", example: "6 71 23 45 67" },
  { name: "Canada", dial: "1", label: "+1", example: "506 234 5678" },
  { name: "Central African Republic", dial: "236", label: "+236", example: "70 01 23 45" },
  { name: "Chad", dial: "235", label: "+235", example: "63 01 23 45" },
  { name: "Chile", dial: "56", label: "+56", example: "9 6123 4567" },
  { name: "China", dial: "86", label: "+86", example: "131 2345 6789" },
  { name: "Colombia", dial: "57", label: "+57", example: "321 1234567" },
  { name: "Comoros", dial: "269", label: "+269", example: "321 23 45" },
  { name: "Congo (Republic)", dial: "242", label: "+242", example: "06 123 4567" },
  { name: "Congo (Democratic Republic)", dial: "243", label: "+243", example: "991 234 567" },
  { name: "Costa Rica", dial: "506", label: "+506", example: "8312 3456" },
  { name: "Cote d'Ivoire", dial: "225", label: "+225", example: "01 23 45 6789" },
  { name: "Croatia", dial: "385", label: "+385", example: "92 123 4567" },
  { name: "Cuba", dial: "53", label: "+53", example: "5 1234567" },
  { name: "Cyprus", dial: "357", label: "+357", example: "96 123456" },
  { name: "Czechia", dial: "420", label: "+420", example: "601 123 456" },
  { name: "Denmark", dial: "45", label: "+45", example: "32 12 34 56" },
  { name: "Djibouti", dial: "253", label: "+253", example: "77 83 10 01" },
  { name: "Dominica", dial: "1767", label: "+1 767", example: "225 1234" },
  { name: "Dominican Republic", dial: "1809", label: "+1 809", example: "234 5678" },
  { name: "Ecuador", dial: "593", label: "+593", example: "99 123 4567" },
  { name: "Egypt", dial: "20", label: "+20", example: "100 123 4567" },
  { name: "El Salvador", dial: "503", label: "+503", example: "7012 3456" },
  { name: "Equatorial Guinea", dial: "240", label: "+240", example: "222 123 456" },
  { name: "Eritrea", dial: "291", label: "+291", example: "7 123 456" },
  { name: "Estonia", dial: "372", label: "+372", example: "5123 4567" },
  { name: "Eswatini", dial: "268", label: "+268", example: "7612 3456" },
  { name: "Ethiopia", dial: "251", label: "+251", example: "91 123 4567" },
  { name: "Fiji", dial: "679", label: "+679", example: "701 2345" },
  { name: "Finland", dial: "358", label: "+358", example: "41 2345678" },
  { name: "France", dial: "33", label: "+33", example: "6 12 34 56 78" },
  { name: "Gabon", dial: "241", label: "+241", example: "06 03 12 34" },
  { name: "Gambia", dial: "220", label: "+220", example: "301 2345" },
  { name: "Georgia", dial: "995", label: "+995", example: "555 12 34 56" },
  { name: "Germany", dial: "49", label: "+49", example: "1512 3456789" },
  { name: "Ghana", dial: "233", label: "+233", example: "23 123 4567" },
  { name: "Greece", dial: "30", label: "+30", example: "691 234 5678" },
  { name: "Grenada", dial: "1473", label: "+1 473", example: "403 1234" },
  { name: "Guatemala", dial: "502", label: "+502", example: "5123 4567" },
  { name: "Guinea", dial: "224", label: "+224", example: "601 12 34 56" },
  { name: "Guinea-Bissau", dial: "245", label: "+245", example: "955 012 345" },
  { name: "Guyana", dial: "592", label: "+592", example: "609 1234" },
  { name: "Haiti", dial: "509", label: "+509", example: "34 10 1234" },
  { name: "Honduras", dial: "504", label: "+504", example: "9123 4567" },
  { name: "Hungary", dial: "36", label: "+36", example: "20 123 4567" },
  { name: "Iceland", dial: "354", label: "+354", example: "611 1234" },
  { name: "India", dial: "91", label: "+91", example: "98765 43210" },
  { name: "Indonesia", dial: "62", label: "+62", example: "812 3456 7890" },
  { name: "Iran", dial: "98", label: "+98", example: "912 345 6789" },
  { name: "Iraq", dial: "964", label: "+964", example: "791 234 5678" },
  { name: "Ireland", dial: "353", label: "+353", example: "85 012 3456" },
  { name: "Israel", dial: "972", label: "+972", example: "50 234 5678" },
  { name: "Italy", dial: "39", label: "+39", example: "312 345 6789" },
  { name: "Jamaica", dial: "1876", label: "+1 876", example: "210 1234" },
  { name: "Japan", dial: "81", label: "+81", example: "90 1234 5678" },
  { name: "Jordan", dial: "962", label: "+962", example: "7 9012 3456" },
  { name: "Kazakhstan", dial: "7", label: "+7", example: "771 000 9998" },
  { name: "Kenya", dial: "254", label: "+254", example: "712 123456" },
  { name: "Kiribati", dial: "686", label: "+686", example: "7214 0123" },
  { name: "Kuwait", dial: "965", label: "+965", example: "500 12345" },
  { name: "Kyrgyzstan", dial: "996", label: "+996", example: "700 123 456" },
  { name: "Laos", dial: "856", label: "+856", example: "20 23 123 456" },
  { name: "Latvia", dial: "371", label: "+371", example: "21 234 567" },
  { name: "Lebanon", dial: "961", label: "+961", example: "71 123 456" },
  { name: "Lesotho", dial: "266", label: "+266", example: "5012 3456" },
  { name: "Liberia", dial: "231", label: "+231", example: "77 012 3456" },
  { name: "Libya", dial: "218", label: "+218", example: "91 2345678" },
  { name: "Liechtenstein", dial: "423", label: "+423", example: "660 234 567" },
  { name: "Lithuania", dial: "370", label: "+370", example: "612 34567" },
  { name: "Luxembourg", dial: "352", label: "+352", example: "628 123 456" },
  { name: "Madagascar", dial: "261", label: "+261", example: "32 12 345 67" },
  { name: "Malawi", dial: "265", label: "+265", example: "991 23 45 67" },
  { name: "Malaysia", dial: "60", label: "+60", example: "12 345 6789" },
  { name: "Maldives", dial: "960", label: "+960", example: "771 2345" },
  { name: "Mali", dial: "223", label: "+223", example: "65 01 23 45" },
  { name: "Malta", dial: "356", label: "+356", example: "9696 1234" },
  { name: "Marshall Islands", dial: "692", label: "+692", example: "235 1234" },
  { name: "Mauritania", dial: "222", label: "+222", example: "22 12 34 56" },
  { name: "Mauritius", dial: "230", label: "+230", example: "5251 2345" },
  { name: "Mexico", dial: "52", label: "+52", example: "55 1234 5678" },
  { name: "Micronesia", dial: "691", label: "+691", example: "350 1234" },
  { name: "Moldova", dial: "373", label: "+373", example: "621 12 345" },
  { name: "Monaco", dial: "377", label: "+377", example: "6 12 34 56 78" },
  { name: "Mongolia", dial: "976", label: "+976", example: "8812 3456" },
  { name: "Montenegro", dial: "382", label: "+382", example: "67 622 901" },
  { name: "Morocco", dial: "212", label: "+212", example: "650 123456" },
  { name: "Mozambique", dial: "258", label: "+258", example: "82 123 4567" },
  { name: "Myanmar", dial: "95", label: "+95", example: "9 212 3456" },
  { name: "Namibia", dial: "264", label: "+264", example: "81 123 4567" },
  { name: "Nauru", dial: "674", label: "+674", example: "555 1234" },
  { name: "Nepal", dial: "977", label: "+977", example: "984 1234567" },
  { name: "Netherlands", dial: "31", label: "+31", example: "6 12345678" },
  { name: "New Zealand", dial: "64", label: "+64", example: "21 123 4567" },
  { name: "Nicaragua", dial: "505", label: "+505", example: "8123 4567" },
  { name: "Niger", dial: "227", label: "+227", example: "93 12 34 56" },
  { name: "Nigeria", dial: "234", label: "+234", example: "802 123 4567" },
  { name: "North Korea", dial: "850", label: "+850", example: "192 123 4567" },
  { name: "North Macedonia", dial: "389", label: "+389", example: "72 345 678" },
  { name: "Norway", dial: "47", label: "+47", example: "406 12 345" },
  { name: "Oman", dial: "968", label: "+968", example: "9212 3456" },
  { name: "Pakistan", dial: "92", label: "+92", example: "301 2345678" },
  { name: "Palau", dial: "680", label: "+680", example: "620 1234" },
  { name: "Palestine", dial: "970", label: "+970", example: "599 123 456" },
  { name: "Panama", dial: "507", label: "+507", example: "6123 4567" },
  { name: "Papua New Guinea", dial: "675", label: "+675", example: "7012 3456" },
  { name: "Paraguay", dial: "595", label: "+595", example: "961 456789" },
  { name: "Peru", dial: "51", label: "+51", example: "912 345 678" },
  { name: "Philippines", dial: "63", label: "+63", example: "905 123 4567" },
  { name: "Poland", dial: "48", label: "+48", example: "512 345 678" },
  { name: "Portugal", dial: "351", label: "+351", example: "912 345 678" },
  { name: "Qatar", dial: "974", label: "+974", example: "3312 3456" },
  { name: "Romania", dial: "40", label: "+40", example: "712 034 567" },
  { name: "Russia", dial: "7", label: "+7", example: "912 345 6789" },
  { name: "Rwanda", dial: "250", label: "+250", example: "720 123 456" },
  { name: "Saint Kitts and Nevis", dial: "1869", label: "+1 869", example: "765 2917" },
  { name: "Saint Lucia", dial: "1758", label: "+1 758", example: "284 5678" },
  { name: "Saint Vincent and the Grenadines", dial: "1784", label: "+1 784", example: "430 1234" },
  { name: "Samoa", dial: "685", label: "+685", example: "72 12345" },
  { name: "San Marino", dial: "378", label: "+378", example: "66 66 12 12" },
  { name: "Sao Tome and Principe", dial: "239", label: "+239", example: "981 2345" },
  { name: "Saudi Arabia", dial: "966", label: "+966", example: "51 234 5678" },
  { name: "Senegal", dial: "221", label: "+221", example: "70 123 45 67" },
  { name: "Serbia", dial: "381", label: "+381", example: "60 1234567" },
  { name: "Seychelles", dial: "248", label: "+248", example: "2 510 123" },
  { name: "Sierra Leone", dial: "232", label: "+232", example: "25 123456" },
  { name: "Singapore", dial: "65", label: "+65", example: "8123 4567" },
  { name: "Slovakia", dial: "421", label: "+421", example: "912 123 456" },
  { name: "Slovenia", dial: "386", label: "+386", example: "31 234 567" },
  { name: "Solomon Islands", dial: "677", label: "+677", example: "74 21234" },
  { name: "Somalia", dial: "252", label: "+252", example: "7 1123456" },
  { name: "South Africa", dial: "27", label: "+27", example: "71 123 4567" },
  { name: "South Korea", dial: "82", label: "+82", example: "10 2000 0000" },
  { name: "South Sudan", dial: "211", label: "+211", example: "977 123 456" },
  { name: "Spain", dial: "34", label: "+34", example: "612 34 56 78" },
  { name: "Sri Lanka", dial: "94", label: "+94", example: "71 234 5678" },
  { name: "Sudan", dial: "249", label: "+249", example: "91 123 1234" },
  { name: "Suriname", dial: "597", label: "+597", example: "741 2345" },
  { name: "Sweden", dial: "46", label: "+46", example: "70 123 45 67" },
  { name: "Switzerland", dial: "41", label: "+41", example: "78 123 45 67" },
  { name: "Syria", dial: "963", label: "+963", example: "944 567 890" },
  { name: "Tajikistan", dial: "992", label: "+992", example: "917 12 3456" },
  { name: "Tanzania", dial: "255", label: "+255", example: "621 234 567" },
  { name: "Thailand", dial: "66", label: "+66", example: "81 234 5678" },
  { name: "Timor-Leste", dial: "670", label: "+670", example: "7721 2345" },
  { name: "Togo", dial: "228", label: "+228", example: "90 11 23 45" },
  { name: "Tonga", dial: "676", label: "+676", example: "771 5123" },
  { name: "Trinidad and Tobago", dial: "1868", label: "+1 868", example: "291 1234" },
  { name: "Tunisia", dial: "216", label: "+216", example: "20 123 456" },
  { name: "Turkey", dial: "90", label: "+90", example: "501 234 5678" },
  { name: "Turkmenistan", dial: "993", label: "+993", example: "66 123456" },
  { name: "Tuvalu", dial: "688", label: "+688", example: "90 1234" },
  { name: "Uganda", dial: "256", label: "+256", example: "712 345678" },
  { name: "Ukraine", dial: "380", label: "+380", example: "50 123 4567" },
  { name: "United Arab Emirates", dial: "971", label: "+971", example: "50 123 4567" },
  { name: "United Kingdom", dial: "44", label: "+44", example: "7400 123456" },
  { name: "United States", dial: "1", label: "+1", example: "201 555 0123" },
  { name: "Uruguay", dial: "598", label: "+598", example: "94 231 234" },
  { name: "Uzbekistan", dial: "998", label: "+998", example: "91 234 56 78" },
  { name: "Vanuatu", dial: "678", label: "+678", example: "591 2345" },
  { name: "Vatican City", dial: "39", label: "+39", example: "06 698 12345" },
  { name: "Venezuela", dial: "58", label: "+58", example: "412 1234567" },
  { name: "Vietnam", dial: "84", label: "+84", example: "91 234 56 78" },
  { name: "Yemen", dial: "967", label: "+967", example: "712 345 678" },
  { name: "Zambia", dial: "260", label: "+260", example: "95 5123456" },
  { name: "Zimbabwe", dial: "263", label: "+263", example: "71 234 5678" },
];

/** India — the default for new numbers. */
export const DEFAULT_COUNTRY = COUNTRY_CODES.find((c) => c.dial === "91")!;

/**
 * Splits a saved phone into country + local number. Numbers saved without
 * a "+" code (every Indian number so far) are India. For a shared code
 * (+1 US/Canada, +7, +39) the first country in the list is picked.
 */
export const splitPhone = (phone: string | null | undefined): { country: CountryCode; number: string } => {
  const value = (phone ?? "").trim();
  if (!value.startsWith("+")) return { country: DEFAULT_COUNTRY, number: value };
  const [head, ...rest] = value.slice(1).split(/\s+/);
  const headDigits = head.replace(/\D/g, "");
  // Longest code that the number starts with ("1268…" before "1").
  const match = [...COUNTRY_CODES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((c) => headDigits.startsWith(c.dial));
  if (!match) return { country: DEFAULT_COUNTRY, number: value };
  const restOfHead = headDigits.slice(match.dial.length);
  const number = [restOfHead, ...rest].filter(Boolean).join(" ");
  const preferred = COUNTRY_CODES.find((c) => c.dial === match.dial && c.name === "United States") ?? match;
  return { country: match.dial === "1" ? preferred : match, number };
};

/**
 * Country + local number -> the value saved on the lead. Indian numbers are
 * saved as before (just the number) so existing data, search and duplicate
 * checks stay the same; any other country is saved as "+<code> <number>".
 */
export const joinPhone = (country: CountryCode, number: string): string => {
  const n = number.trim();
  if (!n) return "";
  if (country.dial === DEFAULT_COUNTRY.dial) return n;
  return `+${country.dial} ${n}`;
};