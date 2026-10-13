Option Explicit
Dim xlApp, xlBook, xlSheet, wb, wbPath, sheetName, host
On Error Resume Next
wbPath = WScript.Arguments(0)
sheetName = WScript.Arguments(1)
Set xlApp = Nothing
For Each host In Array("Excel.Application", "ket.Application")
    Err.Clear
    Set xlApp = GetObject(, host)
    If Not xlApp Is Nothing Then Exit For
Next
If xlApp Is Nothing Then
    For Each host In Array("Excel.Application", "ket.Application")
        Err.Clear
        Set xlApp = CreateObject(host)
        If Not xlApp Is Nothing Then Exit For
    Next
End If
If xlApp Is Nothing Then Fail "AUTOMATION_UNAVAILABLE", 10
Err.Clear
xlApp.Visible = True
Set xlBook = Nothing
For Each wb In xlApp.Workbooks
    If LCase(wb.FullName) = LCase(wbPath) Then
        Set xlBook = wb
        Exit For
    End If
Next
Err.Clear
If xlBook Is Nothing Then Set xlBook = xlApp.Workbooks.Open(wbPath)
If Err.Number <> 0 Or xlBook Is Nothing Then Fail "WORKBOOK_OPEN_FAILED", 11
Err.Clear
Set xlSheet = xlBook.Worksheets(sheetName)
If Err.Number <> 0 Or xlSheet Is Nothing Then Fail "SHEET_NOT_FOUND", 12
If xlSheet.Visible <> -1 Then Fail "SHEET_HIDDEN", 13
Err.Clear
xlBook.Activate
xlSheet.Activate
If Err.Number <> 0 Then Fail "SHEET_ACTIVATE_FAILED", 14
If xlApp.ActiveWorkbook.FullName <> xlBook.FullName Then Fail "SHEET_ACTIVATE_FAILED", 14
If xlApp.ActiveSheet.Name <> sheetName Then Fail "SHEET_ACTIVATE_FAILED", 14
CreateObject("WScript.Shell").AppActivate xlApp.Caption
WScript.Echo "SHEET_ACTIVATED"
WScript.Quit 0

Sub Fail(message, code)
    WScript.Echo message
    WScript.Quit code
End Sub
