// src/components/admin-upload.tsx

import React, { useState, useCallback, useEffect } from 'react';
import { 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Eye, 
  Save, 
  Download,
  FileUp,
  Search,
  Trash2,
  Info,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Filter
} from 'lucide-react';
import { useInterventions } from '../context/InterventionContext';
import Sidebar from './Sidebar';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navigation from './Navigation';

// Extended interface for sorting and deletion
interface InterventionData {
  id?: string;
  clientName: string;
  emissionsAbated: number;
  date: string;
  interventionId: string;
  modality: string;
  geography: string;
  additionality: boolean;
  causality: boolean;
  status: string;
  lowCarbonFuel: string;
  feedstock: string;
  certificationScheme: string;
  vintage: number;
  hasClaims?: boolean;
}

interface Domain {
  id: number;
  name: string;
  companyName: string;
}

interface User {
  id: number;
  email: string;
  domain: {
    name: string;
    companyName: string;
  };
}

interface SortConfig {
  key: keyof InterventionData;
  direction: 'asc' | 'desc';
}

// Helper function to parse Prisma errors into user-friendly messages
const getPrismaErrorMessage = (error: string): string => {
  // Check if it's a field validation error
  const fieldValidationMatch = error.match(/Argument `(\w+)`: Invalid value provided. Expected (\w+), provided (\w+)/);
  
  if (fieldValidationMatch) {
    const [_, field, expectedType, providedType] = fieldValidationMatch;
    return `Invalid data format detected: The field "${field}" contains a ${providedType.toLowerCase()} value where a ${expectedType.toLowerCase()} was expected. Please check your CSV file to ensure all fields have the correct format.\n\nExample: If a number is expected, make sure the cell doesn't contain text or symbols.`;
  }

  // Check for required field errors
  if (error.includes("Required field")) {
    return "Some required fields are missing or empty in your CSV file. Please ensure all mandatory fields are filled out with valid values.";
  }

  // Check for NaN or invalid number errors
  if (error.includes("NaN") || error.includes("Invalid number")) {
    return "Some number fields in your CSV contain invalid values. Please ensure all number fields contain only digits (and decimal points where appropriate).";
  }

  // Default message for unhandled errors
  return "There was an issue with the data format in your CSV file. Please ensure:\n" +
         "• All number fields contain only digits\n" +
         "• Dates are in a valid format (YYYY-MM-DD)\n" +
         "• Required fields are not empty\n" +
         "• Text fields don't contain special characters\n\n" +
         "Review the upload guidelines below for the correct format of each field.";
};

const AdminUpload = () => {
  const { addInterventions, refreshInterventions } = useInterventions();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // State declarations with new additions
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [preview, setPreview] = useState<InterventionData[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [filteredDomains, setFilteredDomains] = useState<Domain[]>([]);
  const [processedData, setProcessedData] = useState<InterventionData[]>([]);
  const [skippedRows, setSkippedRows] = useState<{ row: number; reason: string; content: string }[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'desc' });
  const [selectedInterventions, setSelectedInterventions] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(true);


  // Effect hooks
  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/dashboard');
      return;
    }
  
    const initialize = async () => {
      try {
        // Fetch both domains and interventions in parallel
        const [domainsResponse, interventionsResponse] = await Promise.all([
          axios.get('/api/domains', {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`
            }
          }),
          axios.get('/api/intervention-requests', {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`
            }
          })
        ]);

        setDomains(domainsResponse.data.data);
        
        // Transform the interventions data to match component's data structure
        const interventions = Array.isArray(interventionsResponse.data) 
          ? interventionsResponse.data 
          : [];
        
        setProcessedData(interventions);
        setPreview(interventions.slice(0, 5));
      } catch (err) {
        console.error('Failed to fetch initial data:', err);
        setError('Failed to fetch data. Please refresh the page.');
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [user, navigate]);

  useEffect(() => {
    const filtered = domains.filter(domain => 
      domain.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      domain.companyName.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredDomains(filtered);
  }, [searchTerm, domains]);

  const fetchInterventions = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get('/api/intervention-requests', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.data.success) {
        setProcessedData(response.data.interventions);
        setPreview(response.data.interventions.slice(0, 5));
      }
    } catch (err) {
      console.error('Error fetching interventions:', err);
      setError('Failed to load existing interventions');
    } finally {
      setIsLoading(false);
    }
  };

  // Sort function for data
  const sortData = useCallback((data: InterventionData[]) => {
    return [...data].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [sortConfig]);

  // Handle column sort
  const handleSort = (key: keyof InterventionData) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Delete handler with error handling and loading state
  const handleDeleteIntervention = async (id: string) => {
    try {
      setIsDeleting(true);
      setError('');
      
      const response = await fetch(`/api/interventions/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete intervention');
      }

      // Update local state
      setProcessedData(prev => prev.filter(item => item.interventionId !== id));
      setPreview(prev => prev.filter(item => item.interventionId !== id));
      
      // Refresh data after successful deletion
      if (refreshInterventions) {
        await refreshInterventions();
      }

      setShowDeleteConfirm(false);
      setDeletingId(null);
      setSuccess('Intervention deleted successfully');
      
      // Clear selection if item was selected
      setSelectedInterventions(prev => prev.filter(selectedId => selectedId !== id));

    } catch (error) {
      console.error('Error deleting intervention:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete intervention');
    } finally {
      setIsDeleting(false);
    }
  };

  // Bulk delete handler
  const handleBulkDelete = async () => {
    try {
      setIsDeleting(true);
      setError('');

      // Sequential deletion with error handling
      for (const id of selectedInterventions) {
        try {
          await handleDeleteIntervention(id);
        } catch (error) {
          console.error(`Failed to delete intervention ${id}:`, error);
          throw new Error(`Failed to delete some interventions. Please try again.`);
        }
      }

      setSelectedInterventions([]);
      setSuccess('Selected interventions deleted successfully');

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete selected interventions');
    } finally {
      setIsDeleting(false);
    }
  };

  // Selection handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const selectableInterventions = processedData
        .filter(intervention => !intervention.hasClaims)
        .map(intervention => intervention.interventionId);
      setSelectedInterventions(selectableInterventions);
    } else {
      setSelectedInterventions([]);
    }
  };

  const handleSelectIntervention = (id: string, hasClaims: boolean) => {
    if (hasClaims) return;
    
    setSelectedInterventions(prev => {
      if (prev.includes(id)) {
        return prev.filter(selectedId => selectedId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // Pagination helpers
  const paginatedData = useCallback(() => {
    const sorted = sortData(processedData);
    const start = (page - 1) * itemsPerPage;
    return sorted.slice(start, start + itemsPerPage);
  }, [processedData, page, itemsPerPage, sortData]);

  const totalPages = Math.ceil(processedData.length / itemsPerPage);

  // Function to parse CSV text into structured data
  const parseCSV = useCallback((text: string): InterventionData[] => {
    const skipped: { row: number; reason: string; content: string }[] = [];
    
    // Remove BOM characters
    const cleanText = text.replace(/^\uFEFF/, '');
    
    // Detect delimiter (comma, semicolon, or tab)
    const firstLine = cleanText.split('\n')[0];
    let delimiter = ','; // Default delimiter
    if (firstLine.includes(';')) {
      delimiter = ';';
    } else if (firstLine.includes('\t')) {
      delimiter = '\t';
    }

    // Split into lines and filter out empty lines
    const lines = cleanText.split('\n').filter(line => line.trim());
    
    // Define required columns with possible header variations
    const columnMatchers = {
      clientName: ['CLIENT NAME', 'CLIENT_NAME', 'CLIENTNAME'],
      emissionsAbated: ['EMISSIONS ABATED', 'EMISSIONS_ABATED', 'EMISSIONSABATED'],
      deliveryDate: ['DELIVERY DATE', 'DELIVERY_DATE', 'DELIVERYDATE', 'DATE'],
      interventionId: ['INTERVENTION ID', 'INTERVENTION_ID', 'INTERVENTIONID'],
      lowCarbonFuel: ['LOW CARBON FUEL', 'LOWCARBONFUEL'],
      feedstock: ['FEEDSTOCK', 'FEED_STOCK'],
      certificationScheme: ['CERTIFICATION SCHEME', 'CERTIFICATIONSCHHEME', 'CERTIFICATION_SCHEME']
    };

    // Extract headers and map to indices
    const headers = lines[0].split(delimiter).map(header => header.trim().toUpperCase());
    
    const columnIndices = {
      clientName: headers.findIndex(h => columnMatchers.clientName.some(m => h.includes(m))),
      emissionsAbated: headers.findIndex(h => columnMatchers.emissionsAbated.some(m => h.includes(m))),
      deliveryDate: headers.findIndex(h => columnMatchers.deliveryDate.some(m => h.includes(m))),
      interventionId: headers.findIndex(h => columnMatchers.interventionId.some(m => h.includes(m))),
      lowCarbonFuel: headers.findIndex(h => columnMatchers.lowCarbonFuel.some(m => h.includes(m))),
      feedstock: headers.findIndex(h => columnMatchers.feedstock.some(m => h.includes(m))),
      certificationScheme: headers.findIndex(h => columnMatchers.certificationScheme.some(m => h.includes(m))),
      modality: headers.findIndex(h => h.includes('MODALITY')),
      geography: headers.findIndex(h => h.includes('GEOGRAPHY')),
      additionality: headers.findIndex(h => h.includes('ADDITIONALITY')),
      causality: headers.findIndex(h => h.includes('CAUSALITY'))
    };

    // Check for missing required columns
    const missingColumns = [];
    if (columnIndices.clientName === -1) missingColumns.push('CLIENT NAME');
    if (columnIndices.emissionsAbated === -1) missingColumns.push('EMISSIONS ABATED');
    if (columnIndices.deliveryDate === -1) missingColumns.push('DELIVERY DATE');
    if (columnIndices.interventionId === -1) missingColumns.push('INTERVENTION ID');

    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    // Parse each data row
    const results: InterventionData[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = line.split(delimiter).map(val => cleanValue(val));

        const record: InterventionData = {
          clientName: values[columnIndices.clientName],
          emissionsAbated: parseFloat(values[columnIndices.emissionsAbated].replace(',', '.')) || 0,
          date: parseDate(values[columnIndices.deliveryDate]),
          interventionId: values[columnIndices.interventionId],
          modality: columnIndices.modality !== -1 ? values[columnIndices.modality] : 'Unknown',
          geography: columnIndices.geography !== -1 ? values[columnIndices.geography] : 'Unknown',
          additionality: columnIndices.additionality !== -1 
            ? values[columnIndices.additionality]?.toLowerCase().includes('yes') 
            : false,
          causality: columnIndices.causality !== -1 
            ? values[columnIndices.causality]?.toLowerCase().includes('yes') 
            : false,
          status: 'Verified',
          lowCarbonFuel: columnIndices.lowCarbonFuel !== -1 && values[columnIndices.lowCarbonFuel] 
            ? values[columnIndices.lowCarbonFuel] 
            : 'n/a',
          feedstock: columnIndices.feedstock !== -1 && values[columnIndices.feedstock] 
            ? values[columnIndices.feedstock] 
            : 'n/a',
          certificationScheme: columnIndices.certificationScheme !== -1 && values[columnIndices.certificationScheme] 
            ? values[columnIndices.certificationScheme] 
            : 'n/a',
          vintage: new Date().getFullYear()
        };

        const validationErrors = validateRecord(record);
        if (validationErrors.length === 0) {
          results.push(record);
        } else {
          skipped.push({
            row: i + 1,
            reason: validationErrors.join(' '),
            content: line
          });
        }
      } catch (err) {
        skipped.push({
          row: i + 1,
          reason: err instanceof Error ? err.message : 'Unknown error',
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

  // Function to process the uploaded file
  const processFile = useCallback(async (file: File) => {
    if (!selectedDomain) {
      setError('Please select a domain first.');
      return false; // Return false to indicate processing failed
    }

    // Reset states at the start of processing
    setError('');
    setSuccess('');
    setPreview([]);

    // Validate file size (e.g., max 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      setError(`File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
      return false;
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a CSV file only');
      return false;
    }

    setProcessing(true);
    
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const data = parseCSV(text);  // Parse the CSV data first
        setProcessedData(data);
        setPreview(data.slice(0, 5));

        const formData = new FormData();
        formData.append('file', file);
        formData.append('domainId', selectedDomain.id.toString());

        try {
          const response = await axios.post('/api/admin/upload-interventions', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
              Authorization: `Bearer ${localStorage.getItem('token')}`
            }
          });

          if (response.data.success) {
            // Check if any records were actually created
            const uploadedCount = response.data.createdCount || 0;
            const skippedCount = response.data.skippedRows?.length || 0;

            if (uploadedCount === 0 && skippedCount > 0) {
              setError(`No new records were created. ${skippedCount} rows were skipped - check the skipped rows report for details.`);
            } else if (uploadedCount > 0) {
              setSuccess(
                `Successfully uploaded ${uploadedCount} interventions for ${selectedDomain.companyName}. ` +
                (skippedCount > 0 ? `${skippedCount} rows were skipped - check the skipped rows report for details.` : '')
              );
            }
            
            // Clear the files array
            setFiles([]);
            
            // Fetch the latest data
            try {
              const response = await axios.get('/api/intervention-requests', {
                headers: {
                  Authorization: `Bearer ${localStorage.getItem('token')}`
                }
              });
              
              if (response.data.success) {
                setProcessedData(response.data.interventions);
                setPreview(response.data.interventions.slice(0, 5));
              }
            } catch (err) {
              console.error('Error fetching updated interventions:', err);
            }
            
            // Ensure data is refreshed everywhere
            if (refreshInterventions) {
              await refreshInterventions();
            }
          }
        } catch (err) {
          if (axios.isAxiosError(err) && err.response) {
            console.error('Upload Error Details:', {
              status: err.response?.status,
              statusText: err.response?.statusText,
              data: err.response?.data,
            });

            let errorMessage = 'Failed to upload file';

            switch (err.response.status) {
              case 400:
                errorMessage = err.response.data.error || 'Invalid request. Please check your file format.';
                break;
              case 401:
                errorMessage = 'You are not authorized to upload interventions. Please log in again.';
                break;
              case 413:
                errorMessage = 'File size is too large. Please try a smaller file.';
                break;
              case 415:
                errorMessage = 'Invalid file format. Please upload a CSV file.';
                break;
              case 500:
                if (err.response.data?.error) {
                  errorMessage = getPrismaErrorMessage(err.response.data.error);
                } else {
                  errorMessage = 'An unexpected error occurred. Please try again or contact support if the issue persists.';
                }
                break;
              default:
                errorMessage = 'An error occurred while uploading. Please try again.';
            }

            setError(errorMessage);
          } else {
            console.error('Upload error:', err);
            setError('Failed to upload file');
          }
        }
      } catch (err) {
        console.error('CSV parsing error:', err);
        setError(err instanceof Error ? err.message : 'Failed to parse CSV file');
      } finally {
        setProcessing(false);
      }
    };

    reader.onerror = () => {
      setError('Error reading file');
      setProcessing(false);
    };

    reader.readAsText(file);
    return true; // Return true to indicate processing started successfully
  }, [selectedDomain, refreshInterventions, parseCSV]);

  // Function to parse various date formats into ISO format
  const parseDate = (dateStr: string): string => {
    const formats = [
      /^\d{4}-\d{2}-\d{2}/, // ISO format
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})/, // DD/MM/YYYY or MM/DD/YYYY
      /^(\d{1,2})-(\d{1,2})-(\d{4})/, // DD-MM-YYYY
      /^(\d{1,2})\.(\d{1,2})\.(\d{4})/ // DD.MM.YYYY
    ];

    for (const format of formats) {
      if (format.test(dateStr)) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }
    }
    
    // Fallback to direct parsing
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }

    throw new Error(`Invalid date format: ${dateStr}`);
  };

  // Function to clean CSV cell values
  const cleanValue = (value: string): string => {
    if (!value) return '';
    return value.replace(/^\ufeff/, '').replace(/[\uFEFF\xA0]/g, '').trim();
  };

  // Function to validate an intervention record
  const validateRecord = (record: InterventionData): string[] => {
    const errors: string[] = [];

    if (!record.clientName) errors.push('clientName is required.');
    if (!record.interventionId) errors.push('interventionId is required.');
    if (isNaN(record.emissionsAbated)) errors.push('emissionsAbated must be a number.');
    if (!record.date) errors.push('date is required.');

    return errors;
  };

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      // Only set files if processing starts successfully
      processFile(selectedFiles[0]).then(success => {
        if (success) {
          setFiles(prev => [...prev, ...selectedFiles]);
        }
        // Reset the input value to allow the same file to be selected again
        e.target.value = '';
      });
    }
  }, [processFile]);

  // Function to download skipped rows as a text file
  const downloadSkippedRows = useCallback(() => {
    if (skippedRows.length === 0) return;

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

  // Handlers for drag and drop events
  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
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

    // Only set files if processing starts successfully
    processFile(csvFiles[0]).then(success => {
      if (success) {
        setFiles(prev => [...prev, ...csvFiles]);
      }
    });
  }, [processFile]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#b9dfd9] to-[#fff2ec]">
      <Navigation />
      <div className="flex min-h-[calc(100vh-4rem)]">
        <Sidebar />
        <div className="flex-1 p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header with bulk actions */}
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-[#103D5E]">Upload Intervention Data</h1>
                <p className="text-[#103D5E]/70 mt-1">
                  Import and process intervention records
                </p>
              </div>
              <div className="flex items-center gap-4">
                {selectedInterventions.length > 0 && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isDeleting}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-300 disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <>
                        <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        Delete Selected ({selectedInterventions.length})
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Status Messages with improved styling */}
            {error && (
              <div className="mt-4 backdrop-blur-md p-4 rounded-lg flex items-start space-x-2 bg-red-50/50 text-red-500 border border-red-200">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <div className="font-medium">Error</div>
                  <div className="mt-1 text-sm whitespace-pre-line">{error}</div>
                </div>
                <button 
                  onClick={() => setError('')}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {success && (
              <div className="mt-4 backdrop-blur-md p-4 rounded-lg flex items-center justify-between bg-green-50/50 text-green-500 border border-green-200">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>{success}</span>
                </div>
                <button 
                  onClick={() => setSuccess('')}
                  className="text-green-500 hover:text-green-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* User Selection with improved domain search */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-[#103D5E] mb-1">
                Select Domain
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#103D5E]/40" />
                <input
                  type="text"
                  placeholder="Search domains..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/50 border border-white/20 rounded-lg 
                    focus:outline-none focus:ring-1 focus:ring-[#103D5E] text-[#103D5E]"
                />
              </div>
              
              {/* Domain selection dropdown */}
              {filteredDomains.length > 0 && searchTerm && !selectedDomain && (
                <div className="mt-2 bg-white/50 rounded-lg border border-white/20 max-h-48 overflow-y-auto">
                  {filteredDomains.map(domain => (
                    <button
                      key={domain.id}
                      onClick={() => {
                        setError('');
                        setSelectedDomain(domain);
                        setSearchTerm('');
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-white/50 text-[#103D5E] transition-colors"
                    >
                      <div className="font-medium">{domain.companyName}</div>
                      <div className="text-sm text-[#103D5E]/70">{domain.name}</div>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected domain display */}
              {selectedDomain && (
                <div className="mt-4 flex items-center justify-between bg-white/50 p-4 rounded-lg">
                  <div>
                    <div className="font-medium text-[#103D5E]">{selectedDomain.companyName}</div>
                    <div className="text-sm text-[#103D5E]/70">{selectedDomain.name}</div>
                  </div>
                  <button
                    onClick={() => setSelectedDomain(null)}
                    className="text-red-500 hover:text-red-700 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Upload Zone with improved drag and drop */}
            <div
              className={`bg-white/25 backdrop-blur-md border-2 border-dashed rounded-lg p-8 text-center 
                transition-all duration-300 ${
                dragActive 
                  ? 'border-[#103D5E] bg-[#B9D9DF]/20 scale-[1.02]' 
                  : 'border-white/50 hover:border-[#103D5E]/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <FileUp className={`mx-auto h-12 w-12 text-[#103D5E] transition-transform duration-300 ${
                dragActive ? 'scale-110' : ''
              }`} />
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

            {/* Skipped Rows Download with improved button */}
            {skippedRows.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={downloadSkippedRows}
                  className="flex items-center gap-2 text-[#103D5E] hover:text-[#103D5E]/70 text-sm
                    bg-white/25 px-4 py-2 rounded-lg transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Download skipped rows report ({skippedRows.length} issues found)
                </button>
              </div>
            )}

            {/* Data Preview with improved table */}
            <div className="bg-white/25 backdrop-blur-md rounded-lg p-6 border border-white/20">
              <h2 className="text-lg font-semibold text-[#103D5E] mb-4 flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Uploaded Interventions
              </h2>
              {isLoading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#103D5E]"></div>
                </div>
              ) : processedData.length === 0 ? (
                <div className="text-center py-8 text-[#103D5E]/70">
                  No interventions found. Upload a CSV file to get started.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/20">
                          <th className="px-4 py-2 text-left">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={selectedInterventions.length === processedData.length}
                                onChange={handleSelectAll}
                                className="rounded border-white/20"
                              />
                            </div>
                          </th>
                          {['Client Name', 'Intervention ID', 'Date', 'Emissions Abated', 'Modality', 'Geography', 'Status', 'Actions'].map((header) => (
                            <th 
                              key={header}
                              className="px-4 py-2 text-left cursor-pointer hover:bg-white/10 transition-colors"
                              onClick={() => handleSort(header.toLowerCase().replace(' ', '') as keyof InterventionData)}
                            >
                              <div className="flex items-center space-x-1">
                                <span>{header}</span>
                                {sortConfig.key === header.toLowerCase().replace(' ', '') && (
                                  sortConfig.direction === 'asc' ? 
                                    <ChevronUp className="h-4 w-4" /> : 
                                    <ChevronDown className="h-4 w-4" />
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedData().map((row) => (
                          <tr 
                            key={row.interventionId}
                            className={`border-b border-white/10 hover:bg-white/10 transition-colors ${
                              selectedInterventions.includes(row.interventionId) ? 'bg-white/20' : ''
                            }`}
                          >
                            <td className="px-4 py-2">
                              <input
                                type="checkbox"
                                checked={selectedInterventions.includes(row.interventionId)}
                                onChange={() => handleSelectIntervention(row.interventionId, row.hasClaims || false)}
                                disabled={row.hasClaims}
                                className="rounded border-white/20"
                              />
                            </td>
                            <td className="px-4 py-2">{row.clientName}</td>
                            <td className="px-4 py-2">{row.interventionId}</td>
                            <td className="px-4 py-2">{new Date(row.date).toLocaleDateString()}</td>
                            <td className="px-4 py-2">{row.emissionsAbated.toFixed(1)} tCO2e</td>
                            <td className="px-4 py-2">{row.modality}</td>
                            <td className="px-4 py-2">{row.geography}</td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                row.status === 'Verified' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {row.status}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => {
                                    if (!row.hasClaims) {
                                      setDeletingId(row.interventionId);
                                      setShowDeleteConfirm(true);
                                    }
                                  }}
                                  disabled={row.hasClaims}
                                  className={`p-1 rounded-full transition-colors ${
                                    row.hasClaims 
                                      ? 'text-gray-400 cursor-not-allowed' 
                                      : 'text-red-500 hover:bg-red-50'
                                  }`}
                                  onMouseEnter={() => row.hasClaims && setShowTooltip(row.interventionId)}
                                  onMouseLeave={() => setShowTooltip(null)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                                {showTooltip === row.interventionId && row.hasClaims && (
                                  <div className="absolute bg-black/75 text-white px-2 py-1 rounded text-xs">
                                    Cannot delete: Has active claims
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination controls */}
                  {totalPages > 1 && (
                    <div className="mt-4 flex justify-between items-center">
                      <div className="text-sm text-[#103D5E]/70">
                        Showing {((page - 1) * itemsPerPage) + 1} to {Math.min(page * itemsPerPage, processedData.length)} of {processedData.length} entries
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="px-3 py-1 rounded bg-white/25 text-[#103D5E] disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <span className="text-[#103D5E]">
                          Page {page} of {totalPages}
                        </span>
                        <button
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages}
                          className="px-3 py-1 rounded bg-white/25 text-[#103D5E] disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-white/95 backdrop-blur-md rounded-xl p-6 w-full max-w-md">
                  <h2 className="text-xl font-semibold text-[#103D5E] mb-4">Confirm Delete</h2>
                  <p className="text-[#103D5E]/70 mb-6">
                    {selectedInterventions.length > 0 
                      ? `Are you sure you want to delete ${selectedInterventions.length} selected interventions?`
                      : 'Are you sure you want to delete this intervention?'} 
                    This action cannot be undone.
                  </p>
                  <div className="flex justify-end gap-4">
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeletingId(null);
                      }}
                      disabled={isDeleting}
                      className="px-4 py-2 text-[#103D5E] hover:bg-white/20 rounded-lg transition-all duration-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (selectedInterventions.length > 0) {
                          handleBulkDelete();
                        } else if (deletingId) {
                          handleDeleteIntervention(deletingId);
                        }
                      }}
                      disabled={isDeleting}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-300 
                        disabled:opacity-50 flex items-center gap-2"
                    >
                      {isDeleting ? (
                        <>
                          <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Guidelines Section */}
            <div className="bg-white/25 backdrop-blur-md rounded-lg p-4 flex items-start space-x-3 border border-white/20">
              <AlertCircle className="h-5 w-5 text-[#103D5E] mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-[#103D5E]">Upload Guidelines</h3>
                <ul className="mt-2 text-sm text-[#103D5E]/70 list-disc list-inside space-y-1">
                  <li>CSV files should contain the following required columns: Client Name, Emissions Abated, Delivery Date, Intervention ID, Modality, Geography, Additionality, Causality, Status</li>
                  <li>Optional columns: Low Carbon Fuel, Feedstock, Certification Scheme (if missing, defaults to "n/a")</li>
                  <li>Dates can be in various formats (YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY)</li>
                  <li>Emissions values should be numeric (commas and units will be automatically handled)</li>
                  <li>Files can use different delimiters (comma, semicolon, or tab)</li>
                  <li>Column headers are case-insensitive and can contain partial matches</li>
                  <li>Invalid rows will be skipped and can be reviewed in the skipped rows report</li>
                  <li>Interventions with active claims cannot be deleted</li>
                </ul>
              </div>
            </div>

            {/* Uploaded Files List */}
            {files.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-[#103D5E] mb-4">Uploaded Files</h2>
                <div className="space-y-3">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-white/25 backdrop-blur-md p-4 rounded-lg border border-white/20
                        hover:bg-white/30 transition-colors"
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

            {/* Processed Data Summary */}
            {processedData.length > 0 && (
              <div className="bg-white/25 backdrop-blur-md rounded-lg p-6 border border-white/20">
                <h2 className="text-lg font-semibold text-[#103D5E] mb-4 flex items-center justify-between">
                  <span>Processed Data Summary</span>
                  <span className="text-sm font-normal text-[#103D5E]/70">
                    Total Records: {processedData.length}
                  </span>
                </h2>
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
                    }, {} as Record<string, { 
                      totalEmissions: number; 
                      interventions: number; 
                      modalityBreakdown: Record<string, number> 
                    }>)
                  ).map(([client, data]) => (
                    <div key={client} className="bg-white/20 p-4 rounded-lg hover:bg-white/30 transition-colors">
                      <h3 className="font-medium text-[#103D5E] flex items-center justify-between">
                        <span>{client}</span>
                        <span className="text-sm text-[#103D5E]/70">
                          {data.interventions} intervention{data.interventions > 1 ? 's' : ''}
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUpload;
