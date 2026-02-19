<?php
/**
 * Fetch NSE India API data
 * Gainers: open = low | Losers: open = high
 * Option chain: contract-info → first expiry → option-chain-v3
 */

$headers = [
    'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept: application/json',
    'Accept-Language: en-US,en;q=0.9',
    'Referer: https://www.nseindia.com/',
];

function createNseSession(): string {
    global $headers;
    $cookieFile = sys_get_temp_dir() . '/nse_cookies_' . uniqid() . '.txt';
    $ch = curl_init('https://www.nseindia.com/');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_COOKIEJAR      => $cookieFile,
        CURLOPT_COOKIEFILE     => $cookieFile,
        CURLOPT_HTTPHEADER     => $headers,
    ]);
    curl_exec($ch);
    curl_close($ch);
    return $cookieFile;
}

function fetchNseUrl(string $url, string $cookieFile): array {
    global $headers;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER  => true,
        CURLOPT_FOLLOWLOCATION  => true,
        CURLOPT_TIMEOUT         => 30,
        CURLOPT_SSL_VERIFYPEER  => true,
        CURLOPT_COOKIEFILE      => $cookieFile,
        CURLOPT_HTTPHEADER      => $headers,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        return ['error' => 'Failed to fetch data', 'details' => $curlError];
    }
    if ($httpCode !== 200) {
        return ['error' => "HTTP $httpCode", 'raw' => substr($response, 0, 500)];
    }
    $data = json_decode($response, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        return ['error' => 'Invalid JSON response', 'raw' => substr($response, 0, 500)];
    }
    return $data;
}

function fetchNseData(string $index, string $cookieFile): array {
    $url = 'https://www.nseindia.com/api/live-analysis-variations?index=' . urlencode($index);
    return fetchNseUrl($url, $cookieFile);
}

/** Get option chain contract info (expiryDates, strikePrice) */
function fetchOptionChainContractInfo(string $symbol, string $cookieFile): array {
    $url = 'https://www.nseindia.com/api/option-chain-contract-info?symbol=' . urlencode($symbol);
    return fetchNseUrl($url, $cookieFile);
}

/** Get option chain data for symbol + expiry */
function fetchOptionChainV3(string $symbol, string $expiry, string $cookieFile): array {
    $url = 'https://www.nseindia.com/api/option-chain-v3?type=Equity&symbol=' . urlencode($symbol) . '&expiry=' . urlencode($expiry);
    return fetchNseUrl($url, $cookieFile);
}

/** For each filtered record: fetch option chain for given expiry (or first if not specified) */
function fetchOptionChainForRow(array $row, string $cookieFile, ?string $expiryOverride = null): ?array {
    $symbol = $row['symbol'] ?? $row['Symbol'] ?? $row['symbolFull'] ?? null;
    if (!$symbol) return null;

    $contractInfo = fetchOptionChainContractInfo($symbol, $cookieFile);
    if (isset($contractInfo['error']) || empty($contractInfo['expiryDates'])) {
        return ['error' => $contractInfo['error'] ?? 'No expiry dates'];
    }

    $expiryDates = $contractInfo['expiryDates'];
    $expiry = $expiryOverride;
    if (!$expiry) {
        $expiry = $expiryDates[0] ?? null;
    } else {
        // Validate expiry is in list
        if (!in_array($expiry, $expiryDates, true)) {
            $expiry = $expiryDates[0] ?? null;
        }
    }
    if (!$expiry) return ['error' => 'Empty expiry dates'];

    $optionChain = fetchOptionChainV3($symbol, $expiry, $cookieFile);
    if (isset($optionChain['error'])) {
        return ['error' => $optionChain['error'], 'expiry' => $expiry];
    }

    return array_merge($optionChain, ['expiry' => $expiry, 'allExpiries' => $expiryDates]);
}

/**
 * Get open and low price from a row (handles different API field names)
 */
function getOpenLow(array $row): ?array {
    $open = $row['open_price'] ?? $row['openPrice'] ?? $row['open'] ?? null;
    $low = $row['low_price'] ?? $row['lowPrice'] ?? $row['low'] ?? null;
    if ($open === null || $low === null) return null;
    return ['open' => (float) $open, 'low' => (float) $low];
}

/**
 * Get open and high price from a row
 */
function getOpenHigh(array $row): ?array {
    $open = $row['open_price'] ?? $row['openPrice'] ?? $row['open'] ?? null;
    $high = $row['high_price'] ?? $row['highPrice'] ?? $row['high'] ?? null;
    if ($open === null || $high === null) return null;
    return ['open' => (float) $open, 'high' => (float) $high];
}

/**
 * Extract stock rows from NSE API response - FOSec (F&O Securities) only
 */
function extractAllRows(array $data): array {
    $rows = $data['FOSec']['data'] ?? [];
    return is_array($rows) ? $rows : [];
}

/**
 * Filter rows where open_price = low_price
 */
function filterOpenEqualsLow(array $data): array {
    $rows = extractAllRows($data);
    $filtered = [];
    foreach ($rows as $row) {
        if (!is_array($row)) continue;
        $prices = getOpenLow($row);
        if ($prices && $prices['open'] == $prices['low']) $filtered[] = $row;
    }
    return $filtered;
}

/**
 * Filter rows where open_price = high_price
 */
function filterOpenEqualsHigh(array $data): array {
    $rows = extractAllRows($data);
    $filtered = [];
    foreach ($rows as $row) {
        if (!is_array($row)) continue;
        $prices = getOpenHigh($row);
        if ($prices && $prices['open'] == $prices['high']) $filtered[] = $row;
    }
    return $filtered;
}

/**
 * Get open price from option data (API fields or computed: lastPrice - change)
 */
function getOptOpen(array $d): ?float {
    $open = $d['open_price'] ?? $d['openPrice'] ?? $d['open'] ?? null;
    if ($open !== null) return (float)$open;
    $lp = $d['lastPrice'] ?? null;
    $ch = $d['change'] ?? null;
    if ($lp !== null && $ch !== null && is_numeric($lp) && is_numeric($ch)) {
        return (float)$lp - (float)$ch;
    }
    return null;
}

/**
 * Get low price from option data (API fields or open when open=low)
 */
function getOptLow(array $d, ?float $open): ?float {
    $low = $d['low_price'] ?? $d['lowPrice'] ?? $d['low'] ?? null;
    if ($low !== null) return (float)$low;
    return $open; // when open=low, use open as low for display
}

/**
 * Check if option (CE/PE) has open = low (API fields or computed from lastPrice-change)
 */
function optionOpenEqualsLow(array $optData): bool {
    $open = $optData['open_price'] ?? $optData['openPrice'] ?? $optData['open'] ?? null;
    $low = $optData['low_price'] ?? $optData['lowPrice'] ?? $optData['low'] ?? null;
    if ($open !== null && $low !== null) {
        return (float)$open == (float)$low;
    }
    // NSE option-chain-v3 has lastPrice & change: open = lastPrice - change. When price only went up, open = low.
    $computedOpen = getOptOpen($optData);
    if ($computedOpen === null) return false;
    $ch = $optData['change'] ?? null;
    if ($ch !== null && is_numeric($ch) && (float)$ch >= 0) {
        return true; // price went up from open => open was the low
    }
    if ($low !== null) return (float)$computedOpen == (float)$low;
    return false;
}

/**
 * Filter ALL strikes where open=low, sort by distance from underlying, take closest 4
 */
function getOpenEqualsLowStrikes(array $oc, string $type): array {
    $data = $oc['records']['data'] ?? [];
    $uv = (float)($oc['records']['underlyingValue'] ?? 0);
    if (empty($data)) return [];

    $key = $type === 'CE' ? 'CE' : 'PE';
    $filtered = [];
    foreach ($data as $r) {
        $optData = $r[$key] ?? [];
        if (empty($optData)) continue;
        if (!optionOpenEqualsLow($optData)) continue;
        $strike = (float)($r['strikePrice'] ?? 0);
        $filtered[] = ['strike' => $strike, 'data' => $optData];
    }
    // Sort by distance from underlying, take closest 4
    usort($filtered, function ($a, $b) use ($uv) {
        $da = abs($a['strike'] - $uv);
        $db = abs($b['strike'] - $uv);
        return $da <=> $db;
    });
    return array_slice($filtered, 0, 4);
}

function optVal(array $d, string ...$keys) {
    foreach ($keys as $k) { if (isset($d[$k])) return $d[$k]; } return '—';
}

function optDisplayOpen(array $d) {
    $v = getOptOpen($d);
    return $v !== null ? $v : '—';
}
function optDisplayLow(array $d) {
    $open = getOptOpen($d);
    $low = getOptLow($d, $open);
    return $low !== null ? $low : '—';
}

/**
 * Get display value from row with fallbacks for different field names
 */
function getField(array $row, string ...$keys) {
    foreach ($keys as $key) {
        if (isset($row[$key])) return $row[$key];
    }
    return '—';
}

// Create session once, reuse for all API calls
$cookieFile = createNseSession();

// Fetch gainers and losers (NSE API uses "loosers" - their typo)
$gainersResult = fetchNseData('gainers', $cookieFile);
$losersResult = fetchNseData('loosers', $cookieFile);

// Check for API errors
if (isset($gainersResult['error'])) {
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>NSE Gainers</title></head><body>';
    echo '<h1>Error (Gainers)</h1><p>' . htmlspecialchars($gainersResult['error']) . '</p>';
    if (!empty($gainersResult['details'])) echo '<p>Details: ' . htmlspecialchars($gainersResult['details']) . '</p>';
    echo '</body></html>';
    exit;
}
if (isset($losersResult['error'])) {
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>NSE Losers</title></head><body>';
    echo '<h1>Error (Losers)</h1><p>' . htmlspecialchars($losersResult['error']) . '</p>';
    if (!empty($losersResult['details'])) echo '<p>Details: ' . htmlspecialchars($losersResult['details']) . '</p>';
    echo '</body></html>';
    exit;
}

$filteredGainers = filterOpenEqualsLow($gainersResult);
$filteredLosers = filterOpenEqualsHigh($losersResult);

// Get expiry dates from first available symbol (F&O share same expiries)
$allExpiryDates = [];
$firstSymbol = ($filteredGainers[0]['symbol'] ?? null) ?: ($filteredLosers[0]['symbol'] ?? null);
if ($firstSymbol) {
    $ci = fetchOptionChainContractInfo($firstSymbol, $cookieFile);
    $allExpiryDates = $ci['expiryDates'] ?? [];
    usleep(200000);
}

// Selected expiry: from URL or default first
$selectedExpiry = $_GET['expiry'] ?? null;
if ($selectedExpiry && !in_array($selectedExpiry, $allExpiryDates, true)) {
    $selectedExpiry = $allExpiryDates[0] ?? null;
}
if (!$selectedExpiry && !empty($allExpiryDates)) {
    $selectedExpiry = $allExpiryDates[0];
}

// Fetch option chain for each filtered symbol (gainers + losers) with selected expiry
foreach ($filteredGainers as &$row) {
    $row['_optionChain'] = fetchOptionChainForRow($row, $cookieFile, $selectedExpiry);
    usleep(300000); // 300ms delay between symbols to avoid rate limit
}
unset($row);
foreach ($filteredLosers as &$row) {
    $row['_optionChain'] = fetchOptionChainForRow($row, $cookieFile, $selectedExpiry);
    usleep(300000);
}
unset($row);
@unlink($cookieFile);

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>NSE Gainers & Losers Analysis</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, sans-serif; margin: 2rem; background: #0f1419; color: #e6edf3; }
        h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
        .meta { color: #8b949e; font-size: 0.875rem; margin-bottom: 1.5rem; }
        .table-wrap { overflow-x: auto; border-radius: 8px; border: 1px solid #30363d; }
        table { width: 100%; border-collapse: collapse; min-width: 600px; }
        th { background: #21262d; padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: #c9d1d9; border-bottom: 1px solid #30363d; }
        td { padding: 0.75rem 1rem; border-bottom: 1px solid #21262d; }
        tr:hover { background: #161b22; }
        .symbol { font-weight: 600; color: #58a6ff; }
        .price { font-variant-numeric: tabular-nums; }
        .positive { color: #3fb950; }
        .negative { color: #f85149; }
        .no-data { text-align: center; padding: 3rem; color: #8b949e; }
        section { margin-bottom: 2.5rem; }
        section h2 { font-size: 1.15rem; margin-bottom: 0.5rem; }
        .options-cell { font-size: 0.8rem; }
        .options-toggle { cursor: pointer; color: #58a6ff; text-decoration: underline; }
        .options-detail { display: none; font-size: 0.75rem; margin-top: 0.5rem; padding: 0.5rem; background: #161b22; border-radius: 4px; max-height: 200px; overflow: auto; }
        .options-detail.show { display: block; }
        .opt-row { display: grid; grid-template-columns: 70px 70px 70px 70px; gap: 0.5rem; padding: 0.35rem 0; border-bottom: 1px solid #21262d; align-items: center; }
        .opt-header { font-weight: 600; color: #8b949e; }
        .opt-ce { color: #3fb950; }
        .opt-pe { color: #f85149; }
        .expiry-bar { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; padding: 1rem; background: #161b22; border-radius: 8px; border: 1px solid #30363d; }
        .expiry-bar label { font-weight: 500; color: #c9d1d9; }
        .expiry-bar select { padding: 0.5rem 2rem 0.5rem 0.75rem; background: #21262d; border: 1px solid #30363d; border-radius: 6px; color: #e6edf3; font-size: 0.9rem; cursor: pointer; }
        .expiry-bar select:hover { border-color: #58a6ff; }
        .expiry-bar button { padding: 0.5rem 1rem; background: #238636; border: none; border-radius: 6px; color: #fff; font-weight: 500; cursor: pointer; }
        .expiry-bar button:hover { background: #2ea043; }
    </style>
</head>
<body>
    <?php if (!empty($allExpiryDates)): ?>
    <div class="expiry-bar">
        <form method="get" action="" style="display:flex;align-items:center;gap:1rem;">
            <label for="expiry">Expiry Date:</label>
            <select name="expiry" id="expiry" onchange="this.form.submit()">
                <?php foreach ($allExpiryDates as $ed): ?>
                <option value="<?= htmlspecialchars($ed) ?>" <?= $ed === $selectedExpiry ? 'selected' : '' ?>><?= htmlspecialchars($ed) ?></option>
                <?php endforeach; ?>
            </select>
            <noscript><button type="submit">Apply</button></noscript>
        </form>
    </div>
    <?php endif; ?>

    <section>
        <h2>F&O Gainers — Open Price = Low Price</h2>
        <p class="meta">F&O securities where opening price equals the day's low (<?= count($filteredGainers) ?> found)</p>
        <div class="table-wrap">
            <?php if (empty($filteredGainers)): ?>
                <p class="no-data">No gainers with open price = low price at the moment.</p>
            <?php else: ?>
            <table>
                <thead>
                    <tr>
                        <th>Symbol</th>
                        <th>Company</th>
                        <th>Open</th>
                        <th>Low</th>
                        <th>High</th>
                        <th>Last / LTP</th>
                        <th>Change %</th>
                        <th>Options</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($filteredGainers as $i => $row): $oc = $row['_optionChain'] ?? null; ?>
                <tr>
                    <td class="symbol"><?= htmlspecialchars(getField($row, 'symbol', 'Symbol', 'symbolFull')) ?></td>
                    <td><?= htmlspecialchars(getField($row, 'identifier', 'companyName', 'series', 'symbol')) ?></td>
                    <td class="price"><?= htmlspecialchars(getField($row, 'open_price', 'openPrice', 'open')) ?></td>
                    <td class="price"><?= htmlspecialchars(getField($row, 'low_price', 'lowPrice', 'low')) ?></td>
                    <td class="price"><?= htmlspecialchars(getField($row, 'high_price', 'highPrice', 'high')) ?></td>
                    <td class="price"><?= htmlspecialchars(getField($row, 'ltp', 'lastPrice', 'ltP', 'last', 'close')) ?></td>
                    <?php $pct = getField($row, 'pChange', 'perChange', 'percentChange'); ?>
                    <td class="price <?= is_numeric($pct) && (float)$pct >= 0 ? 'positive' : 'negative' ?>">
                        <?= htmlspecialchars($pct) ?>%
                    </td>
                    <td class="options-cell">
                        <?php if ($oc && !isset($oc['error'])): 
                            $strikes = getOpenEqualsLowStrikes($oc, 'CE'); ?>
                            <span class="options-toggle" onclick="this.nextElementSibling.classList.toggle('show')">
                                Exp: <?= htmlspecialchars($oc['expiry'] ?? '') ?> · CE (open=low, max 4)
                            </span>
                            <div class="options-detail">
                                <?php if (empty($strikes)): ?>
                                    <span style="color:#8b949e">No CE with open=low</span>
                                <?php else: ?>
                                <div class="opt-row opt-header"><span>Strike</span><span>Open</span><span>Current</span><span>Low</span></div>
                                <?php foreach ($strikes as $s): $d = $s['data']; ?>
                                <div class="opt-row">
                                    <span><?= (int)$s['strike'] ?></span>
                                    <span><?= htmlspecialchars(optDisplayOpen($d)) ?></span>
                                    <span class="opt-ce"><?= htmlspecialchars(optVal($d, 'lastPrice', 'sellPrice1', 'buyPrice1')) ?></span>
                                    <span><?= htmlspecialchars(optDisplayLow($d)) ?></span>
                                </div>
                                <?php endforeach; ?>
                                <?php endif; ?>
                            </div>
                        <?php else: ?>
                            <span style="color:#8b949e"><?= htmlspecialchars($oc['error'] ?? '—') ?></span>
                        <?php endif; ?>
                    </td>
                </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            <?php endif; ?>
        </div>
    </section>

    <section>
        <h2>F&O Losers — Open Price = High Price</h2>
        <p class="meta">F&O securities where opening price equals the day's high (<?= count($filteredLosers) ?> found)</p>
        <div class="table-wrap">
            <?php if (empty($filteredLosers)): ?>
                <p class="no-data">No losers with open price = high price at the moment.</p>
            <?php else: ?>
            <table>
                <thead>
                    <tr>
                        <th>Symbol</th>
                        <th>Company</th>
                        <th>Open</th>
                        <th>Low</th>
                        <th>High</th>
                        <th>Last / LTP</th>
                        <th>Change %</th>
                        <th>Options</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($filteredLosers as $row): $oc = $row['_optionChain'] ?? null; ?>
                <tr>
                    <td class="symbol"><?= htmlspecialchars(getField($row, 'symbol', 'Symbol', 'symbolFull')) ?></td>
                    <td><?= htmlspecialchars(getField($row, 'identifier', 'companyName', 'series', 'symbol')) ?></td>
                    <td class="price"><?= htmlspecialchars(getField($row, 'open_price', 'openPrice', 'open')) ?></td>
                    <td class="price"><?= htmlspecialchars(getField($row, 'low_price', 'lowPrice', 'low')) ?></td>
                    <td class="price"><?= htmlspecialchars(getField($row, 'high_price', 'highPrice', 'high')) ?></td>
                    <td class="price"><?= htmlspecialchars(getField($row, 'ltp', 'lastPrice', 'ltP', 'last', 'close')) ?></td>
                    <?php $pct = getField($row, 'pChange', 'perChange', 'percentChange'); ?>
                    <td class="price <?= is_numeric($pct) && (float)$pct >= 0 ? 'positive' : 'negative' ?>">
                        <?= htmlspecialchars($pct) ?>%
                    </td>
                    <td class="options-cell">
                        <?php if ($oc && !isset($oc['error'])): 
                            $strikes = getOpenEqualsLowStrikes($oc, 'PE'); ?>
                            <span class="options-toggle" onclick="this.nextElementSibling.classList.toggle('show')">
                                Exp: <?= htmlspecialchars($oc['expiry'] ?? '') ?> · PE (open=low, max 4)
                            </span>
                            <div class="options-detail">
                                <?php if (empty($strikes)): ?>
                                    <span style="color:#8b949e">No PE with open=low</span>
                                <?php else: ?>
                                <div class="opt-row opt-header"><span>Strike</span><span>Open</span><span>Current</span><span>Low</span></div>
                                <?php foreach ($strikes as $s): $d = $s['data']; ?>
                                <div class="opt-row">
                                    <span><?= (int)$s['strike'] ?></span>
                                    <span><?= htmlspecialchars(optDisplayOpen($d)) ?></span>
                                    <span class="opt-pe"><?= htmlspecialchars(optVal($d, 'lastPrice', 'sellPrice1', 'buyPrice1')) ?></span>
                                    <span><?= htmlspecialchars(optDisplayLow($d)) ?></span>
                                </div>
                                <?php endforeach; ?>
                                <?php endif; ?>
                            </div>
                        <?php else: ?>
                            <span style="color:#8b949e"><?= htmlspecialchars($oc['error'] ?? '—') ?></span>
                        <?php endif; ?>
                    </td>
                </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            <?php endif; ?>
        </div>
    </section>
</body>
</html>