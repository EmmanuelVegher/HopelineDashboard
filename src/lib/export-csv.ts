
import Papa from 'papaparse';

export function exportToCsv(data: object[], filename: string) {
    if (!data || data.length === 0) {
        console.error("No data provided to export.");
        return;
    }

    const csv = Papa.unparse(data, {
        quotes: true,
        header: true,
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
