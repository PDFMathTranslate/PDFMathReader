// Host Explorer's IContextMenu rather than constructing recipients or sending files ourselves.
export const POWERSHELL_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
try {
    Add-Type -AssemblyName System.Windows.Forms
    $source = @'
using System;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

namespace PdfMathReader.Windows {
    [ComImport, Guid("000214e6-0000-0000-c000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IShellFolder {
        void ParseDisplayName(IntPtr hwnd, IntPtr bind, IntPtr name, IntPtr eaten, IntPtr pidl, IntPtr attributes);
        void EnumObjects(IntPtr hwnd, uint flags, IntPtr result);
        void BindToObject(IntPtr pidl, IntPtr bind, ref Guid iid, IntPtr result);
        void BindToStorage(IntPtr pidl, IntPtr bind, ref Guid iid, IntPtr result);
        [PreserveSig] int CompareIDs(IntPtr param, IntPtr first, IntPtr second);
        void CreateViewObject(IntPtr hwnd, ref Guid iid, IntPtr result);
        void GetAttributesOf(uint count, IntPtr items, IntPtr attributes);
        void GetUIObjectOf(IntPtr hwnd, uint count, [MarshalAs(UnmanagedType.LPArray, SizeParamIndex=1)] IntPtr[] items,
            ref Guid iid, IntPtr reserved, [MarshalAs(UnmanagedType.Interface)] out object result);
    }
    [ComImport, Guid("000214e8-0000-0000-c000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IShellExtInit {
        void Initialize(IntPtr folder, System.Runtime.InteropServices.ComTypes.IDataObject data, IntPtr key);
    }
    [ComImport, Guid("000214e4-0000-0000-c000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IContextMenu {
        [PreserveSig] int QueryContextMenu(IntPtr menu, uint index, uint first, uint last, uint flags);
        void InvokeCommand(ref CommandInfo info);
        [PreserveSig] int GetCommandString(UIntPtr id, uint flags, IntPtr reserved,
            [MarshalAs(UnmanagedType.LPWStr)] StringBuilder text, uint size);
    }
    [ComImport, Guid("000214f4-0000-0000-c000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IContextMenu2 {
        [PreserveSig] int QueryContextMenu(IntPtr menu, uint index, uint first, uint last, uint flags);
        void InvokeCommand(ref CommandInfo info);
        [PreserveSig] int GetCommandString(UIntPtr id, uint flags, IntPtr reserved, IntPtr text, uint size);
        [PreserveSig] int HandleMenuMsg(uint message, IntPtr wParam, IntPtr lParam);
    }
    [ComImport, Guid("bcfce0a0-ec17-11d0-8d10-00a0c90f2719"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IContextMenu3 {
        [PreserveSig] int QueryContextMenu(IntPtr menu, uint index, uint first, uint last, uint flags);
        void InvokeCommand(ref CommandInfo info);
        [PreserveSig] int GetCommandString(UIntPtr id, uint flags, IntPtr reserved, IntPtr text, uint size);
        [PreserveSig] int HandleMenuMsg(uint message, IntPtr wParam, IntPtr lParam);
        [PreserveSig] int HandleMenuMsg2(uint message, IntPtr wParam, IntPtr lParam, out IntPtr result);
    }
    [StructLayout(LayoutKind.Sequential)]
    struct CommandInfo {
        public uint size, mask;
        public IntPtr hwnd, verb, parameters, directory;
        public int show;
        public uint hotKey;
        public IntPtr icon;
    }
    class MenuHost : Form {
        public IContextMenu2 Menu2;
        public IContextMenu3 Menu3;
        protected override void WndProc(ref Message message) {
            if (message.Msg == 0x117 || message.Msg == 0x120 || message.Msg == 0x2b || message.Msg == 0x2c) {
                IntPtr result;
                if (Menu3 != null && Menu3.HandleMenuMsg2((uint)message.Msg, message.WParam, message.LParam, out result) >= 0) {
                    message.Result = result;
                    return;
                }
                if (Menu2 != null && Menu2.HandleMenuMsg((uint)message.Msg, message.WParam, message.LParam) >= 0) {
                    message.Result = IntPtr.Zero;
                    return;
                }
            }
            base.WndProc(ref message);
        }
    }
    public static class SendToBridge {
        [DllImport("shell32.dll", CharSet=CharSet.Unicode, PreserveSig=false)]
        static extern void SHParseDisplayName(string name, IntPtr bind, out IntPtr pidl, uint flags, out uint attributes);
        [DllImport("shell32.dll", PreserveSig=false)]
        static extern void SHBindToParent(IntPtr pidl, ref Guid iid, [MarshalAs(UnmanagedType.Interface)] out IShellFolder parent, out IntPtr child);
        [DllImport("user32.dll")] static extern IntPtr CreatePopupMenu();
        [DllImport("user32.dll")] static extern bool DestroyMenu(IntPtr menu);
        [DllImport("user32.dll")] static extern int GetMenuItemCount(IntPtr menu);
        [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetMenuString(IntPtr menu, uint item, StringBuilder text, int max, uint flags);
        [DllImport("user32.dll")] static extern IntPtr GetSubMenu(IntPtr menu, int position);
        [DllImport("user32.dll")] static extern uint TrackPopupMenuEx(IntPtr menu, uint flags, int x, int y, IntPtr hwnd, IntPtr parameters);
        [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hwnd);
        [DllImport("user32.dll")] static extern bool PostMessage(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam);

        public static int Inspect(string owner, string path) { return RunMenu(owner, path, false); }
        public static int Run(string owner, string path) { return RunMenu(owner, path, true); }
        static int RunMenu(string owner, string path, bool display) {
            IntPtr pidl = IntPtr.Zero, root = IntPtr.Zero;
            IShellFolder folder = null;
            IContextMenu context = null;
            object data = null, extension = null;
            IntPtr ownerHandle = new IntPtr(long.Parse(owner));
            using (MenuHost host = new MenuHost()) {
                try {
                    uint attributes;
                    SHParseDisplayName(path, IntPtr.Zero, out pidl, 0, out attributes);
                    Guid folderId = typeof(IShellFolder).GUID;
                    IntPtr child;
                    SHBindToParent(pidl, ref folderId, out folder, out child);
                    Guid dataId = typeof(System.Runtime.InteropServices.ComTypes.IDataObject).GUID;
                    folder.GetUIObjectOf(ownerHandle, 1, new IntPtr[] { child }, ref dataId, IntPtr.Zero, out data);
                    // Ask the system Send To handler for its localized submenu label.
                    // Never hardcode a translated label or enumerate recipients ourselves.
                    extension = Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("7ba4c740-9e81-11cf-99d3-00aa004ae837")));
                    ((IShellExtInit)extension).Initialize(IntPtr.Zero, (System.Runtime.InteropServices.ComTypes.IDataObject)data, IntPtr.Zero);
                    context = (IContextMenu)extension;
                    root = CreatePopupMenu();
                    if (root == IntPtr.Zero) throw new InvalidOperationException("Cannot create the system menu.");
                    int status = context.QueryContextMenu(root, 0, 1, 0x7fff, 0);
                    Marshal.ThrowExceptionForHR(status);
                    StringBuilder sendToLabel = new StringBuilder(256);
                    GetMenuString(root, 0, sendToLabel, 256, 0x400);
                    if (sendToLabel.Length == 0) throw new InvalidOperationException("Explorer's Send To handler is unavailable.");
                    DestroyMenu(root);
                    root = IntPtr.Zero;
                    Marshal.ReleaseComObject(extension);
                    extension = null;
                    context = null;
                    // The complete Shell context supplies the services needed by dynamic
                    // recipients. CMF_SYNCCASCADEMENU makes Windows populate them synchronously.
                    Guid menuId = typeof(IContextMenu).GUID;
                    folder.GetUIObjectOf(ownerHandle, 1, new IntPtr[] { child }, ref menuId, IntPtr.Zero, out extension);
                    context = (IContextMenu)extension;
                    host.Menu3 = context as IContextMenu3;
                    host.Menu2 = context as IContextMenu2;
                    root = CreatePopupMenu();
                    if (root == IntPtr.Zero) throw new InvalidOperationException("Cannot create the system menu.");
                    Marshal.ThrowExceptionForHR(context.QueryContextMenu(root, 0, 1, 0x7fff, 0x1000));
                    IntPtr sendTo = IntPtr.Zero;
                    int position = -1;
                    for (int i = 0; i < GetMenuItemCount(root); i++) {
                        IntPtr submenu = GetSubMenu(root, i);
                        StringBuilder label = new StringBuilder(256);
                        GetMenuString(root, (uint)i, label, 256, 0x400);
                        if (submenu != IntPtr.Zero && label.ToString() == sendToLabel.ToString()) {
                            sendTo = submenu;
                            position = i;
                            break;
                        }
                    }
                    if (sendTo == IntPtr.Zero) throw new InvalidOperationException("Explorer's Send To menu is unavailable for this file.");
                    // Send To is populated lazily by the Shell extension when its submenu opens.
                    IntPtr ignored;
                    if (host.Menu3 != null) host.Menu3.HandleMenuMsg2(0x117, sendTo, new IntPtr(position), out ignored);
                    else if (host.Menu2 != null) host.Menu2.HandleMenuMsg(0x117, sendTo, new IntPtr(position));
                    if (GetMenuItemCount(sendTo) <= 0) throw new InvalidOperationException("Explorer's Send To menu has no recipients.");
                    if (!display) {
                        Console.WriteLine("NATIVE_MENU\t" + GetMenuItemCount(sendTo));
                        return 0;
                    }
                    Point cursor = Cursor.Position;
                    host.ShowInTaskbar = false;
                    host.FormBorderStyle = FormBorderStyle.None;
                    host.StartPosition = FormStartPosition.Manual;
                    host.Location = cursor;
                    host.Size = new Size(1, 1);
                    host.Opacity = 0;
                    host.Show();
                    SetForegroundWindow(host.Handle);
                    Console.WriteLine("READY");
                    Console.Out.Flush();
                    uint command = TrackPopupMenuEx(sendTo, 0x100, cursor.X, cursor.Y, host.Handle, IntPtr.Zero);
                    PostMessage(host.Handle, 0, IntPtr.Zero, IntPtr.Zero);
                    if (command == 0) {
                        SetForegroundWindow(ownerHandle);
                        Console.WriteLine("RESULT\tcancelled");
                        return 2;
                    }
                    CommandInfo info = new CommandInfo();
                    info.size = (uint)Marshal.SizeOf(typeof(CommandInfo));
                    info.hwnd = ownerHandle;
                    info.verb = new IntPtr(command - 1);
                    info.show = 1;
                    context.InvokeCommand(ref info);
                    Console.WriteLine("RESULT\tsuccess");
                    return 0;
                } finally {
                    host.Menu2 = null;
                    host.Menu3 = null;
                    if (root != IntPtr.Zero) DestroyMenu(root);
                    if (extension != null) Marshal.ReleaseComObject(extension);
                    if (data != null) Marshal.ReleaseComObject(data);
                    if (folder != null) Marshal.ReleaseComObject(folder);
                    if (pidl != IntPtr.Zero) Marshal.FreeCoTaskMem(pidl);
                }
            }
        }
    }
}
'@
    Add-Type -TypeDefinition $source -Language CSharp -ReferencedAssemblies System.Windows.Forms,System.Drawing | Out-Null
    $result = [PdfMathReader.Windows.SendToBridge]::Run($env:PDFMATHREADER_SHARE_HWND, $env:PDFMATHREADER_SHARE_PATH)
    exit ([int]$result)
} catch {
    $message = $_.Exception.ToString().Replace([char]9, ' ').Replace([char]13, ' ').Replace([char]10, ' ')
    [Console]::Error.WriteLine(('ERROR' + [char]9 + 'SendTo' + [char]9 + $message))
    exit 1
}
`;
