// src/components/template-management.tsx

import React, { useState, useEffect } from 'react';
import { Upload, Save, Trash2, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';


interface TemplateField {
  key: string;
  label: string;
  format?: string;
  required?: boolean;
}

interface TemplateSection {
  title: string;
  fields: TemplateField[];
}

interface TemplateConfig {
  name: string;
  headerImage?: string;
  logo?: string;
  primaryColor: { r: number; g: number; b: number };
  secondaryColor: { r: number; g: number; b: number };
  sections: TemplateSection[];
  layout: any;
  footer: any;
  watermark: any;
}

const TemplateManagement: React.FC = () => {
  const { user } = useAuth();
  const [template, setTemplate] = useState<TemplateConfig | null>(null);
  const [headerImage, setHeaderImage] = useState<File | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplate();
  }, []);

  const fetchTemplate = async () => {
    try {
      const response = await fetch(`/api/domains/${user.domainId}/template`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setTemplate(data);
      }
    } catch (error) {
      console.error('Error fetching template:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'header' | 'logo') => {
    const file = event.target.files?.[0];
    if (file) {
      if (type === 'header') {
        setHeaderImage(file);
      } else {
        setLogo(file);
      }
    }
  };

  const handleColorChange = (color: string, type: 'primary' | 'secondary') => {
    if (!template) return;

    // Convert hex to RGB
    const r = parseInt(color.slice(1, 3), 16) / 255;
    const g = parseInt(color.slice(3, 5), 16) / 255;
    const b = parseInt(color.slice(5, 7), 16) / 255;

    setTemplate({
      ...template,
      [type === 'primary' ? 'primaryColor' : 'secondaryColor']: { r, g, b }
    });
  };

  const handleSectionChange = (sectionIndex: number, updatedSection: TemplateSection) => {
    if (!template) return;

    const newSections = [...template.sections];
    newSections[sectionIndex] = updatedSection;
    setTemplate({ ...template, sections: newSections });
  };

  const handlePreview = async () => {
    try {
      const response = await fetch(`/api/domains/${user.domainId}/template/preview`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      }
    } catch (error) {
      console.error('Error generating preview:', error);
    }
  };

  const handleSave = async () => {
    try {
      const formData = new FormData();
      if (headerImage) {
        formData.append('headerImage', headerImage);
      }
      if (logo) {
        formData.append('logo', logo);
      }
      formData.append('template', JSON.stringify(template));

      const response = await fetch(`/api/domains/${user.domainId}/template`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (response.ok) {
        // Reset file inputs
        setHeaderImage(null);
        setLogo(null);
        // Refresh template
        await fetchTemplate();
      }
    } catch (error) {
      console.error('Error saving template:', error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-[#103D5E]">Statement Template</h2>
          <div className="flex gap-4">
            <button
              onClick={handlePreview}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Eye className="h-5 w-5" />
              Preview
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-[#103D5E] text-white rounded-lg hover:bg-[#103D5E]/90 transition-colors"
            >
              <Save className="h-5 w-5" />
              Save Changes
            </button>
          </div>
        </div>

        {/* Template Form */}
        <div className="space-y-6">
          {/* Basic Settings */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Template Name
              </label>
              <input
                type="text"
                value={template?.name || ''}
                onChange={(e) => setTemplate(template ? { ...template, name: e.target.value } : null)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#103D5E]"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Primary Color
              </label>
              <input
                type="color"
                value={`#${Math.round(template?.primaryColor.r * 255).toString(16).padStart(2, '0')}${
                  Math.round(template?.primaryColor.g * 255).toString(16).padStart(2, '0')}${
                  Math.round(template?.primaryColor.b * 255).toString(16).padStart(2, '0')}`}
                onChange={(e) => handleColorChange(e.target.value, 'primary')}
                className="w-full h-10 rounded-lg"
              />
            </div>
          </div>

          {/* Image Uploads */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Header Image
              </label>
              <div className="flex items-center gap-4">
                {template?.headerImage && (
                  <img
                    src={template.headerImage}
                    alt="Header"
                    className="h-16 object-contain rounded"
                  />
                )}
                <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer">
                  <Upload className="h-5 w-5" />
                  Upload New
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e, 'header')}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Logo
              </label>
              <div className="flex items-center gap-4">
                {template?.logo && (
                  <img
                    src={template.logo}
                    alt="Logo"
                    className="h-16 object-contain rounded"
                  />
                )}
                <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer">
                  <Upload className="h-5 w-5" />
                  Upload New
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e, 'logo')}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Sections Editor */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[#103D5E]">Sections</h3>
            {template?.sections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="border rounded-lg p-4">
                <input
                  type="text"
                  value={section.title}
                  onChange={(e) => {
                    const updatedSection = { ...section, title: e.target.value };
                    handleSectionChange(sectionIndex, updatedSection);
                  }}
                  className="text-lg font-semibold mb-4 w-full px-3 py-2 border rounded-lg"
                />
                
                {/* Fields Editor */}
                <div className="space-y-2">
                  {section.fields.map((field, fieldIndex) => (
                    <div key={fieldIndex} className="grid grid-cols-3 gap-4">
                      <input
                        type="text"
                        value={field.key}
                        onChange={(e) => {
                          const updatedFields = [...section.fields];
                          updatedFields[fieldIndex] = { ...field, key: e.target.value };
                          handleSectionChange(sectionIndex, { ...section, fields: updatedFields });
                        }}
                        className="px-3 py-2 border rounded-lg"
                        placeholder="Field Key"
                      />
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => {
                          const updatedFields = [...section.fields];
                          updatedFields[fieldIndex] = { ...field, label: e.target.value };
                          handleSectionChange(sectionIndex, { ...section, fields: updatedFields });
                        }}
                        className="px-3 py-2 border rounded-lg"
                        placeholder="Display Label"
                      />
                      <select
                        value={field.format || 'text'}
                        onChange={(e) => {
                          const updatedFields = [...section.fields];
                          updatedFields[fieldIndex] = { ...field, format: e.target.value };
                          handleSectionChange(sectionIndex, { ...section, fields: updatedFields });
                        }}
                        className="px-3 py-2 border rounded-lg"
                      >
                        <option value="text">Text</option>
                        <option value="date">Date</option>
                        <option value="number">Number</option>
                        <option value="percentage">Percentage</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-[#103D5E]">Template Preview</h2>
              <button
                onClick={() => {
                  setPreviewUrl(null);
                  URL.revokeObjectURL(previewUrl);
                }}
                className="text-[#103D5E] hover:text-[#103D5E]/70"
              >
                ×
              </button>
            </div>
            <iframe
              src={previewUrl}
              className="flex-1 w-full rounded-lg border border-gray-200"
            />
          </div>
        </div>
      )}
    </div>
  );
};