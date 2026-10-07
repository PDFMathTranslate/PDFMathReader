const CLIENTS = ['ChatGPT', 'Claude', 'Gemini'];

// No prompt text enters AppleScript: the clipboard carries the context.
const PASTE_SCRIPT = `on run argv
  set clientName to item 1 of argv
  tell application "System Events"
    repeat 40 times
      if exists process clientName then
        tell process clientName
          set frontmost to true
          if frontmost then
            try
              set focusedRole to role of value of attribute "AXFocusedUIElement"
              if focusedRole is "AXTextArea" then
                keystroke "v" using command down
                return "pasted"
              end if
            end try
          end if
        end tell
      end if
      delay 0.1
    end repeat
  end tell
  error "No focused conversation text field"
end run`;

export function createAIDiscussionService({ platform = process.platform, runFile, clipboard }) {
  async function installed(client) {
    try {
      await runFile('/usr/bin/open', ['-Ra', client], { timeout: 10000 });
      return true;
    } catch {
      return false;
    }
  }

  async function list() {
    if (platform !== 'darwin') return [];
    const available = await Promise.all(CLIENTS.map(installed));
    return CLIENTS.filter((_, index) => available[index]);
  }

  async function open(client, text) {
    if (!CLIENTS.includes(client)) throw Error('Invalid AI client.');
    if (typeof text !== 'string' || !text.trim() || text.length > 1000000)
      throw Error('Invalid discussion text.');
    if (platform !== 'darwin') throw Error('本机 AI 对话目前仅支持 macOS。');
    if (!(await installed(client))) throw Error(`未找到本机 ${client}，请先安装。`);
    if (client === 'Claude' && text.length <= 14000) {
      await runFile(
        '/usr/bin/open',
        ['-a', client, `claude://claude.ai/new?q=${encodeURIComponent(text)}`],
        { timeout: 10000 },
      );
      return { client, delivery: 'prefilled' };
    }
    clipboard.writeText(text);
    await runFile('/usr/bin/open', ['-a', client], { timeout: 10000 });
    try {
      await runFile('/usr/bin/osascript', ['-e', PASTE_SCRIPT, '--', client], { timeout: 10000 });
      return { client, delivery: 'pasted' };
    } catch {
      return { client, delivery: 'clipboard' };
    }
  }

  return { list, open };
}
