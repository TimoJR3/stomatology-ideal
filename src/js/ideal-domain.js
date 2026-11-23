/* На домене IDEAL главной служит визитка клиники. */
if (['stomatology-ideal.ru', 'www.stomatology-ideal.ru'].includes(location.hostname)) {
  const card = new URL('/card/', location.origin);
  card.search = location.search;
  card.hash = location.hash;
  location.replace(card.href);
}
