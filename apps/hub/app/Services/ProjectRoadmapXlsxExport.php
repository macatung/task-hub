<?php

namespace App\Services;

use App\Models\Project;
use App\Models\Task;
use Carbon\Carbon;
use DateTimeInterface;
use ZipArchive;

/**
 * Small, dependency-free XLSX writer for the Roadmap export.
 * The application image already includes the PHP Zip and XML extensions.
 */
class ProjectRoadmapXlsxExport
{
    public function build(Project $project): string
    {
        $tasks = Task::with(['sprint', 'epic'])
            ->where('project_id', $project->id)
            ->orderByRaw("CASE WHEN issue_type = 'epic' THEN 0 ELSE 1 END")
            ->orderBy('issue_key')
            ->get();

        $workItems = $tasks->where('issue_type', '!=', 'epic');
        $today = Carbon::today()->toDateString();
        $summary = [
            ['Project', $project->title],
            ['Project key', $project->effective_key],
            ['Exported at', Carbon::now()],
            ['Total work items', $workItems->count()],
            ['Completed work items', $workItems->where('status', 'done')->count()],
            ['Completion rate', $workItems->count() ? round($workItems->where('status', 'done')->count() / $workItems->count() * 100) / 100 : 0],
            ['Total story points', $workItems->sum('story_points')],
            ['Completed story points', $workItems->where('status', 'done')->sum('story_points')],
            ['Open overdue items', $workItems->filter(fn (Task $task) => $task->status !== 'done' && $task->due_date && $task->due_date->toDateString() < $today)->count()],
            [],
            ['Status', 'Items'],
            ...collect(['todo', 'in_progress', 'review', 'done'])->map(fn ($status) => [str($status)->replace('_', ' ')->title()->toString(), $workItems->where('status', $status)->count()])->all(),
            [],
            ['Priority', 'Items'],
            ...collect(['urgent', 'high', 'medium', 'low'])->map(fn ($priority) => [str($priority)->title()->toString(), $workItems->where('priority', $priority)->count()])->all(),
        ];

        $roadmap = [[
            'Issue key', 'Epic', 'Status', 'Priority', 'Start date', 'Due date', 'Story points', 'Linked tasks', 'Completed tasks', 'Progress', 'Description',
        ]];
        foreach ($tasks->where('issue_type', 'epic') as $epic) {
            $children = $workItems->where('epic_id', $epic->id);
            $roadmap[] = [
                $epic->issue_key, $epic->title, $epic->status, $epic->priority, $epic->start_date, $epic->due_date,
                $epic->story_points, $children->count(), $children->where('status', 'done')->count(),
                $children->count() ? round($children->where('status', 'done')->count() / $children->count() * 100) / 100 : ($epic->status === 'done' ? 1 : 0),
                $epic->description,
            ];
        }

        $register = [[
            'Issue key', 'Title', 'Type', 'Epic', 'Sprint', 'Status', 'Priority', 'Story points', 'Start date', 'Due date', 'Completed at', 'Estimate (pomodoros)', 'Completed pomodoros', 'Description',
        ]];
        foreach ($tasks as $task) {
            $register[] = [
                $task->issue_key, $task->title, $task->issue_type, $task->epic?->issue_key, $task->sprint?->name,
                $task->status, $task->priority, $task->story_points, $task->start_date, $task->due_date,
                $task->completed_at, $task->estimated_pomodoros, $task->completed_pomodoros, $task->description,
            ];
        }

        $path = tempnam(sys_get_temp_dir(), 'task-hub-roadmap-');
        $zip = new ZipArchive();
        if ($path === false || $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new \RuntimeException('Unable to create the Excel export.');
        }

        $sheets = [
            ['Summary', $summary, [26, 34]],
            ['Roadmap', $roadmap, [15, 38, 15, 14, 14, 14, 14, 14, 16, 14, 54]],
            ['Tasks', $register, [15, 38, 12, 15, 24, 15, 14, 14, 14, 14, 20, 22, 22, 54]],
        ];
        $zip->addFromString('[Content_Types].xml', $this->contentTypes());
        $zip->addFromString('_rels/.rels', $this->rootRelationships());
        $zip->addFromString('xl/workbook.xml', $this->workbook($sheets));
        $zip->addFromString('xl/_rels/workbook.xml.rels', $this->workbookRelationships(count($sheets)));
        $zip->addFromString('xl/styles.xml', $this->styles());
        foreach ($sheets as $index => [$name, $rows, $widths]) {
            $zip->addFromString('xl/worksheets/sheet' . ($index + 1) . '.xml', $this->worksheet($rows, $widths));
        }
        $zip->close();

        return $path;
    }

    private function worksheet(array $rows, array $widths): string
    {
        $columns = '';
        foreach ($widths as $index => $width) {
            $columns .= '<col min="' . ($index + 1) . '" max="' . ($index + 1) . '" width="' . $width . '" customWidth="1"/>';
        }
        $xml = '';
        foreach ($rows as $rowNumber => $row) {
            $cells = '';
            foreach ($row as $columnNumber => $value) {
                $reference = $this->columnName($columnNumber + 1) . ($rowNumber + 1);
                $style = $rowNumber === 0 || (isset($row[0]) && in_array($row[0], ['Status', 'Priority'], true)) ? 1 : 0;
                $cells .= $this->cell($reference, $value, $style);
            }
            $xml .= '<row r="' . ($rowNumber + 1) . '">' . $cells . '</row>';
        }
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>' . $columns . '</cols><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>' . $xml . '</sheetData><autoFilter ref="A1:' . $this->columnName(count($widths)) . max(1, count($rows)) . '"/></worksheet>';
    }

    private function cell(string $reference, mixed $value, int $style): string
    {
        if ($value instanceof DateTimeInterface) {
            $serial = ($value->getTimestamp() / 86400) + 25569;
            return '<c r="' . $reference . '" s="2" t="n"><v>' . $serial . '</v></c>';
        }
        if (is_numeric($value) && $value !== '') return '<c r="' . $reference . '" s="' . $style . '" t="n"><v>' . $value . '</v></c>';
        return '<c r="' . $reference . '" s="' . $style . '" t="inlineStr"><is><t xml:space="preserve">' . htmlspecialchars((string) ($value ?? ''), ENT_XML1 | ENT_QUOTES, 'UTF-8') . '</t></is></c>';
    }

    private function columnName(int $number): string
    {
        $name = '';
        while ($number > 0) { $number--; $name = chr(65 + ($number % 26)) . $name; $number = intdiv($number, 26); }
        return $name;
    }

    private function contentTypes(): string { return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'; }
    private function rootRelationships(): string { return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'; }
    private function workbook(array $sheets): string { $xml = ''; foreach ($sheets as $index => [$name]) $xml .= '<sheet name="' . htmlspecialchars($name, ENT_XML1 | ENT_QUOTES, 'UTF-8') . '" sheetId="' . ($index + 1) . '" r:id="rId' . ($index + 1) . '"/>'; return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' . $xml . '</sheets></workbook>'; }
    private function workbookRelationships(int $count): string { $xml = ''; for ($i = 1; $i <= $count; $i++) $xml .= '<Relationship Id="rId' . $i . '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' . $i . '.xml"/>'; return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' . $xml . '<Relationship Id="rId' . ($count + 1) . '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'; }
    private function styles(): string { return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>'; }
}
