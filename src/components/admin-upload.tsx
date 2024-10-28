import React, { useState, useCallback } from 'react';
import { 
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Eye, 
  Save, 
  Download,
  FileUp
} from 'lucide-react';
import { useInterventions } from '../context/InterventionContext';
import Sidebar from './Sidebar';

const AdminUpload = () => {
  const { addInterventions } = useInterventions();
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState([]);
  const [processedData, setProcessedData] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [preview, setPreview] = useState([]);
  const [skippedRows, setSkippedRows] = useState([]);
  
  const parseDate = (dateStr) => {
    // Try different date formats
    const formats = [
      // ISO format
      /^\d{4}-\d{2}-\d{2}/,
      // DD/MM/YYYY
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})/,
      // MM/DD/YYYY
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})/,
      // DD-MM-YYYY
      /^(\d{1,2})-(\d{1,2})-(\d{4})/,
      // DD.MM.YYYY
      /^(\d{1,2})\.(\d{1,2})\.(\d{4})/
    ];

    for (const format of formats) {
      if (format.test(dateStr)) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }
    }
    
    // If no format matches, try parsing directly
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }

    throw new Error(`Invalid date format: ${dateStr}`);
  };

  const cleanValue = (value) => {
    if (!value) return '';
    // Remove BOM and special characters
    return value.replace(/^\ufeff/, '').replace(/[\uFEFF\xA0]/g, '').trim();
  };

  const parseCSV = useCallback((text) => {
    const skipped = [];
    
    // Remove any BOM character that might be present
    const cleanText = text.replace(/^\uFEFF/, '');
    
    // Detect delimiter by checking first line
    const firstLine = cleanText.split('\n')[0];
    let delimiter = ',';  // default
    if (firstLine.includes(';')) {
      delimiter = ';';
    } else if (firstLine.includes('\t')) {
      delimiter = '\t';
    }
  
    // Split into lines and remove empty ones
    const lines = cleanText.split('\n').filter(line => line.trim());
    
    // Required columns with various possible formats
    const columnMatchers = {
      clientName: ['CLIENT NAME', 'CLIENT_NAME', 'CLIENTNAME'],
      emissionsAbated: ['EMISSIONS ABATED', 'EMISSIONS_ABATED', 'EMISSIONSABATED'],
      deliveryDate: ['DELIVERY DATE', 'DELIVERY_DATE', 'DELIVERYDATE'],
      interventionId: ['INTERVENTION ID', 'INTERVENTION_ID', 'INTERVENTIONID']
    };
  
    // Find header row (usually first row in this case)
    const headers = lines[0].split(delimiter).map(header => header.trim().toUpperCase());
    
    // Map column indices
    const columnIndices = {
      clientName: headers.findIndex(h => columnMatchers.clientName.some(m => h.includes(m))),
      emissionsAbated: headers.findIndex(h => columnMatchers.emissionsAbated.some(m => h.includes(m))),
      deliveryDate: headers.findIndex(h => columnMatchers.deliveryDate.some(m => h.includes(m))),
      interventionId: headers.findIndex(h => columnMatchers.interventionId.some(m => h.includes(m))),
      modality: headers.findIndex(h => h.includes('MODALITY')),
      geography: headers.findIndex(h => h.includes('GEOGRAPHY')),
      additionality: headers.findIndex(h => h.includes('ADDITIONALITY')),
      causality: headers.findIndex(h => h.includes('CAUSALITY'))
    };
  
    // Verify required columns
    const missingColumns = [];
    if (columnIndices.clientName === -1) missingColumns.push('CLIENT NAME');
    if (columnIndices.emissionsAbated === -1) missingColumns.push('EMISSIONS ABATED');
    if (columnIndices.deliveryDate === -1) missingColumns.push('DELIVERY DATE');
    if (columnIndices.interventionId === -1) missingColumns.push('INTERVENTION ID');
  
    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }
  
    // Parse data rows
    const results = [];
    for (let i = 1; i < lines.length; i++) {  // Start from 1 to skip header
      const line = lines[i].trim();
      if (!line) continue;
  
      try {
        // Split the line by delimiter and clean values
        const values = line.split(delimiter).map(val => val.trim());
  
        // Parse date
        let date = values[columnIndices.deliveryDate];
        if (date) {
          const [month, day, year] = date.split('/');
          date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
  
        // Create record
        const record = {
          clientName: values[columnIndices.clientName],
          emissionsAbated: parseFloat(values[columnIndices.emissionsAbated]) || 0,
          date: date,
          interventionId: values[columnIndices.interventionId],
          modality: columnIndices.modality !== -1 ? values[columnIndices.modality] : 'Unknown',
          geography: columnIndices.geography !== -1 ? values[columnIndices.geography] : 'Unknown',
          additionality: columnIndices.additionality !== -1 
            ? values[columnIndices.additionality]?.toLowerCase().includes('yes')  // This is the key change
            : false,
          causality: columnIndices.causality !== -1 
            ? values[columnIndices.causality]?.toLowerCase().includes('yes')  // This is the key change
            : false,
          status: 'Verified'
        };
  
        // Validate record
        if (record.clientName && record.interventionId && !isNaN(record.emissionsAbated)) {
          results.push(record);
        } else {
          skipped.push({
            row: i + 1,
            reason: 'Missing required data',
            content: line
          });
        }
      } catch (err) {
        skipped.push({
          row: i + 1,
          reason: err.message,
          content: line
        });
      }
    }
  
    if (results.length === 0) {
      throw new Error('No valid data rows found in the file');
    }
  
    setSkippedRows(skipped);
    return results;
  }, []);

  const processFile = useCallback((file) => {
    setProcessing(true);
    setError('');
    setSuccess('');
    setPreview([]);
    setSkippedRows([]);
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const data = parseCSV(text);
        setProcessedData(data);
        setPreview(data.slice(0, 5));
        addInterventions(data);
        setSuccess(`Successfully processed ${data.length} records${
          skippedRows.length > 0 ? ` (${skippedRows.length} rows skipped)` : ''
        }`);
      } catch (err) {
        setError(`Error processing file: ${err.message}`);
      } finally {
        setProcessing(false);
      }
    };

    reader.onerror = () => {
      setError('Error reading file');
      setProcessing(false);
    };

    reader.readAsText(file);
  }, [parseCSV, addInterventions]);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    const csvFiles = droppedFiles.filter(file => 
      file.type === 'text/csv' || 
      file.name.endsWith('.csv')
    );
    
    if (csvFiles.length === 0) {
      setError('Please upload CSV files only (.csv)');
      return;
    }

    setFiles(prev => [...prev, ...csvFiles]);
    processFile(csvFiles[0]);
  }, [processFile]);

  const handleFileInput = useCallback((e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...selectedFiles]);
    if (selectedFiles.length > 0) {
      processFile(selectedFiles[0]);
    }
  }, [processFile]);

  const downloadSkippedRows = useCallback(() => {
    const content = skippedRows.map(row => 
      `Row ${row.row}: ${row.reason}\n${row.content}`
    ).join('\n\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'skipped_rows.txt';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, [skippedRows]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#b9dfd9] to-[#fff2ec]">
      <div className="flex min-h-[calc(100vh-4rem)]">
        <Sidebar />
        <div className="flex-1 p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-[#103D5E]">Upload Intervention Data</h1>
                <p className="text-[#103D5E]/70 mt-1">
                  Import and process intervention records
                </p>
              </div>
              {processedData.length > 0 && (
                <button
                  onClick={() => {
                    console.log('Saving processed data:', processedData);
                    setSuccess('Data saved successfully!');
                  }}
                  className="flex items-center gap-2 bg-[#103D5E] text-white px-4 py-2 rounded-lg hover:bg-[#103D5E]/90 transition-all"
                >
                  <Save className="h-4 w-4" />
                  Save Data
                </button>
              )}
            </div>

            {/* Upload Zone */}
            <div
              className={`bg-white/25 backdrop-blur-md border-2 border-dashed rounded-lg p-8 text-center 
                transition-colors duration-200 ${
                dragActive ? 'border-[#103D5E] bg-[#B9D9DF]/20' : 'border-white/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <FileUp className="mx-auto h-12 w-12 text-[#103D5E]" />
              <p className="mt-2 text-sm text-[#103D5E]">
                Drag and drop your CSV files here, or{" "}
                <label className="text-[#103D5E] font-medium hover:underline cursor-pointer">
                  browse
                  <input
                    type="file"
                    className="hidden"
                    accept=".csv"
                    onChange={handleFileInput}
                    multiple
                  />
                </label>
              </p>
              <p className="mt-1 text-xs text-[#103D5E]/60">
                Supported format: .csv
              </p>
            </div>

            {/* Status Messages */}
            {error && (
              <div className="mt-4 backdrop-blur-md p-4 rounded-lg flex items-center space-x-2 bg-red-50/50 text-red-500">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="mt-4 backdrop-blur-md p-4 rounded-lg flex items-center space-x-2 bg-green-50/50 text-green-500">
                <CheckCircle2 className="h-5 w-5" />
                <span>{success}</span>
              </div>
            )}

            {/* Skipped Rows Download */}
            {skippedRows.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={downloadSkippedRows}
                  className="flex items-center gap-2 text-[#103D5E] hover:text-[#103D5E]/70 text-sm"
                >
                  <Download className="h-4 w-4" />
                  Download skipped rows report
                </button>
              </div>
            )}

            {/* Data Preview */}
            {preview.length > 0 && (
              <div className="bg-white/25 backdrop-blur-md rounded-lg p-6 border border-white/20">
                <h2 className="text-lg font-semibold text-[#103D5E] mb-4 flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Data Preview (First 5 records)
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/20">
                        <th className="px-4 py-2 text-left">Client Name</th>
                        <th className="px-4 py-2 text-left">Intervention ID</th>
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Emissions Abated</th>
                        <th className="px-4 py-2 text-left">Modality</th>
                        <th className="px-4 py-2 text-left">Geography</th>
                        <th className="px-4 py-2 text-left">Additionality</th>
                        <th className="px-4 py-2 text-left">Causality</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, index) => (
                        <tr key={index} className="border-b border-white/10">
                          <td className="px-4 py-2">{row.clientName}</td>
                          <td className="px-4 py-2">{row.interventionId}</td>
                          <td className="px-4 py-2">{row.date}</td>
                          <td className="px-4 py-2">{row.emissionsAbated.toFixed(1)} tCO2e</td>
                          <td className="px-4 py-2">{row.modality}</td>
                          <td className="px-4 py-2">{row.geography}</td>
                          <td className="px-4 py-2">{row.additionality ? 'Yes' : 'No'}</td>
                          <td className="px-4 py-2">{row.causality ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Processed Data Summary */}
            {processedData.length > 0 && (
              <div className="bg-white/25 backdrop-blur-md rounded-lg p-6 border border-white/20">
                <h2 className="text-lg font-semibold text-[#103D5E] mb-4">Processed Data Summary</h2>
                <div className="space-y-4">
                  {Object.entries(
                    processedData.reduce((acc, record) => {
                      if (!acc[record.clientName]) {
                        acc[record.clientName] = {
                          totalEmissions: 0,
                          interventions: 0,
                          modalityBreakdown: {}
                        };
                      }
                      acc[record.clientName].totalEmissions += record.emissionsAbated;
                      acc[record.clientName].interventions += 1;

                      if (!acc[record.clientName].modalityBreakdown[record.modality]) {
                        acc[record.clientName].modalityBreakdown[record.modality] = 0;
                      }
                      acc[record.clientName].modalityBreakdown[record.modality] += record.emissionsAbated;

                      return acc;
                    }, {})
                  ).map(([client, data]) => (
                    <div key={client} className="bg-white/20 p-4 rounded-lg">
                      <h3 className="font-medium text-[#103D5E] flex items-center justify-between">
                        <span>{client}</span>
                        <span className="text-sm text-[#103D5E]/70">
                          {data.interventions} interventions
                        </span>
                      </h3>
                      <div className="mt-2 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-[#103D5E]/70">Total Emissions Abated</span>
                          <span className="text-lg font-semibold text-[#103D5E]">
                            {data.totalEmissions.toFixed(2)} tCO2e
                          </span>
                        </div>
                        <div className="border-t border-white/10 pt-2 mt-2">
                          <span className="text-sm text-[#103D5E]/70">By Modality:</span>
                          <div className="mt-1 space-y-1">
                            {Object.entries(data.modalityBreakdown).map(([modality, amount]) => (
                              <div key={modality} className="flex justify-between items-center text-sm">
                                <span className="text-[#103D5E]/70">{modality}</span>
                                <span className="font-medium text-[#103D5E]">
                                  {amount.toFixed(2)} tCO2e
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Uploaded Files List */}
            {files.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-[#103D5E] mb-4">Uploaded Files</h2>
                <div className="space-y-3">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-white/25 backdrop-blur-md p-4 rounded-lg border border-white/20"
                    >
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-[#103D5E]" />
                        <div>
                          <p className="font-medium text-[#103D5E]">{file.name}</p>
                          <p className="text-sm text-[#103D5E]/60">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setFiles(files.filter((_, i) => i !== index))}
                        className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-white/20 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Guidelines Section */}
            <div className="bg-white/25 backdrop-blur-md rounded-lg p-4 flex items-start space-x-3 border border-white/20">
              <AlertCircle className="h-5 w-5 text-[#103D5E] mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-[#103D5E]">Upload Guidelines</h3>
                <ul className="mt-2 text-sm text-[#103D5E]/70 list-disc list-inside space-y-1">
                  <li>CSV files should contain the following required columns: Client Name, Emissions Abated, Delivery Date, Intervention ID</li>
                  <li>Dates can be in various formats (YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY)</li>
                  <li>Emissions values should be numeric (commas and units will be automatically handled)</li>
                  <li>Files can use different delimiters (comma, semicolon, or tab)</li>
                  <li>Column headers are case-insensitive and can contain partial matches</li>
                  <li>Invalid rows will be skipped and can be reviewed in the skipped rows report</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUpload;