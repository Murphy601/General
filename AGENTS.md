# AGENTS.md

## Project overview

This repository is a single **MetaTrader 5 (MQL5) Expert Advisor** (algorithmic trading
bot): `EMA_RSI_RiskBot_v2.mq5`. It implements an EMA-crossover + RSI strategy with ATR
risk management. There is no package manager, no test suite, and no build system in the
usual sense — the "build" is compiling the `.mq5` to an `.ex5` with MetaEditor, and
"running" it means executing it inside the MetaTrader 5 terminal / Strategy Tester.

## Cursor Cloud specific instructions

The dev toolchain (MetaTrader 5 is a Windows app) runs on this Linux VM via **Wine**.
Wine (`winehq-staging`) and a full MetaTrader 5 install live in the Wine prefix at
`~/.mt5` and are captured in the VM snapshot, so they normally do **not** need to be
reinstalled. Standard env for every MT5 command:

```bash
export WINEPREFIX=$HOME/.mt5
export DISPLAY=:1
export WINEDEBUG=-all
export WINEDLLOVERRIDES="mscoree=d;mshtml=d"   # disable wine-mono/gecko prompts
```

Key paths (note: terminal is run with `/portable`, so data lives under the install dir):
- Install dir: `~/.mt5/drive_c/Program Files/MetaTrader 5`
- MetaEditor: `MetaEditor64.exe`  •  Terminal: `terminal64.exe`  •  Tester: `metatester64.exe`
- MQL5 source tree: `.../MetaTrader 5/MQL5` (Experts, Include/Trade/Trade.mqh, etc.)

### CRITICAL gotcha: "A debugger has been found running in your system"

MT5's `mt5setup.exe`, `terminal64.exe` and `MetaEditor64.exe` abort with this dialog when
Wine's just-in-time debugger registry value is present. Wine's `wineboot` **recreates**
`HKLM\Software\Microsoft\Windows NT\CurrentVersion\AeDebug\Debugger = winedbg ...` on every
**cold** start, so it must be cleared again each session, and a `wineserver` must be kept
alive so the deletion survives (a warm start does not re-run `wineboot`). Run this once per
session before launching any MT5 executable:

```bash
export WINEPREFIX=$HOME/.mt5 DISPLAY=:1 WINEDEBUG=-all WINEDLLOVERRIDES="mscoree=d;mshtml=d"
# keep a persistent wineserver so AeDebug is not recreated by a later wineboot:
nohup wineserver -p -f >/dev/null 2>&1 &
sleep 2
wineboot -u >/dev/null 2>&1            # warm/initialise the prefix once (recreates AeDebug)
wine reg delete "HKLM\\Software\\Microsoft\\Windows NT\\CurrentVersion\\AeDebug" /v Debugger /f
wine reg delete "HKLM\\Software\\Wow6432Node\\Microsoft\\Windows NT\\CurrentVersion\\AeDebug" /v Debugger /f
```

Notes / further gotchas:
- The Wine windows version is set to **win11** (`HKCU\Software\Wine` `Version=win11`); this
  is part of the same fix and is already set in the prefix.
- Do **not** pipe Wine command output through `tail`/`head`: with a persistent wineserver,
  Wine service children keep the pipe open and the command appears to hang. Redirect to a
  file instead (`>/tmp/x.log 2>&1`) and read that.
- MetaEditor log files are **UTF-16LE**; decode with `iconv -f UTF-16LE -t UTF-8 <file>`.

### Build (compile) the EA

```bash
cd "$HOME/.mt5/drive_c/Program Files/MetaTrader 5"
cp /workspace/EMA_RSI_RiskBot_v2.mq5 "MQL5/Experts/EMA_RSI_RiskBot_v2.mq5"
wine MetaEditor64.exe /compile:"MQL5\\Experts\\EMA_RSI_RiskBot_v2.mq5" /log:"MQL5\\Experts\\compile_log.txt"
iconv -f UTF-16LE -t UTF-8 "MQL5/Experts/compile_log.txt"   # look for "0 errors"
```

`MetaEditor64.exe` returns a non-zero exit code even on success — trust the log
(`Result: 0 errors, 0 warnings`) and the produced `.ex5`, not the exit code.

### Run the EA

```bash
cd "$HOME/.mt5/drive_c/Program Files/MetaTrader 5"
wine terminal64.exe /portable     # starts the GUI on DISPLAY=:1 (use computer use to interact)
```

- A **MetaQuotes-Demo** account is already created and saved in the prefix (it auto-logs in
  and streams quotes). The **Strategy Tester requires a logged-in account** — without one
  it fails with "tester not started because the account is not specified". If the demo
  account is ever lost, recreate it via `File -> Open an Account -> MetaQuotes-Demo ->
  demo account`; the registration form's Date-of-Birth uses a calendar popup (click its
  month/year header to zoom out to year selection).
- The standard "run" demonstration is a Strategy Tester backtest: open it with `Ctrl+R`,
  select Expert `Experts\EMA_RSI_RiskBot_v2`, a symbol (e.g. EURUSD), a timeframe, model
  "Open prices only", a date range, then Start. History downloads automatically on first
  run and is cached afterward.
