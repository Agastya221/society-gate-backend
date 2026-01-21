import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { onboardingAPI, uploadAPI } from '../api/client';
import { Building2, Home, Upload, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';

type Step = 'society' | 'block' | 'flat' | 'role' | 'documents' | 'submit';

export default function OnboardingFlow() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>('society');
  
  const [selectedSociety, setSelectedSociety] = useState<any>(null);
  const [selectedBlock, setSelectedBlock] = useState<any>(null);
  const [selectedFlat, setSelectedFlat] = useState<any>(null);
  const [residentType, setResidentType] = useState<'OWNER' | 'TENANT'>('OWNER');
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  // Fetch societies
  const { data: societies, isLoading: loadingSocieties } = useQuery({
    queryKey: ['societies'],
    queryFn: async () => {
      const response = await onboardingAPI.getSocieties();
      return response.data.data;
    },
  });

  // Fetch blocks
  const { data: blocks, isLoading: loadingBlocks } = useQuery({
    queryKey: ['blocks', selectedSociety?.id],
    queryFn: async () => {
      const response = await onboardingAPI.getBlocks(selectedSociety.id);
      return response.data.data;
    },
    enabled: !!selectedSociety && currentStep === 'block',
  });

  // Fetch flats
  const { data: flats, isLoading: loadingFlats } = useQuery({
    queryKey: ['flats', selectedSociety?.id, selectedBlock?.id],
    queryFn: async () => {
      const response = await onboardingAPI.getFlats(selectedSociety.id, selectedBlock.id);
      return response.data.data;
    },
    enabled: !!selectedSociety && !!selectedBlock && currentStep === 'flat',
  });

  // Submit onboarding request
  const submitMutation = useMutation({
    mutationFn: () =>
      onboardingAPI.submitRequest({
        societyId: selectedSociety.id,
        blockId: selectedBlock.id,
        flatId: selectedFlat.id,
        residentType,
        documents,
      }),
    onSuccess: () => {
      toast.success('Onboarding request submitted successfully!');
      navigate('/status');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to submit request');
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      const uploadedDoc = await uploadAPI.uploadDocument(file);
      setDocuments((prev) => [
        ...prev.filter((d) => d.type !== type),
        { type, ...uploadedDoc },
      ]);
      toast.success(`${type} uploaded successfully`);
    } catch (error) {
      toast.error('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'society':
        return !!selectedSociety;
      case 'block':
        return !!selectedBlock;
      case 'flat':
        return !!selectedFlat;
      case 'role':
        return !!residentType;
      case 'documents':
        const requiredDocs = residentType === 'OWNER' 
          ? ['OWNERSHIP_PROOF', 'AADHAR_CARD']
          : ['TENANT_AGREEMENT', 'AADHAR_CARD'];
        return requiredDocs.every((type) => documents.some((d) => d.type === type));
      default:
        return false;
    }
  };

  const nextStep = () => {
    const steps: Step[] = ['society', 'block', 'flat', 'role', 'documents', 'submit'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const prevStep = () => {
    const steps: Step[] = ['society', 'block', 'flat', 'role', 'documents', 'submit'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {['Society', 'Block', 'Flat', 'Role', 'Documents', 'Submit'].map((label, index) => {
              const steps: Step[] = ['society', 'block', 'flat', 'role', 'documents', 'submit'];
              const isActive = currentStep === steps[index];
              const isCompleted = steps.indexOf(currentStep) > index;
              
              return (
                <div key={label} className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isActive
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {isCompleted ? <CheckCircle className="w-6 h-6" /> : index + 1}
                  </div>
                  <span className="ml-2 text-sm font-medium hidden md:block">{label}</span>
                  {index < 5 && (
                    <div className={`w-12 h-1 mx-2 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Society Selection */}
          {currentStep === 'society' && (
            <div>
              <h2 className="text-2xl font-bold mb-6 flex items-center">
                <Building2 className="w-6 h-6 mr-2" />
                Select Your Society
              </h2>
              {loadingSocieties ? (
                <div className="text-center py-8">Loading societies...</div>
              ) : (
                <div className="grid gap-4">
                  {societies?.map((society: any) => (
                    <button
                      key={society.id}
                      onClick={() => setSelectedSociety(society)}
                      className={`p-4 border-2 rounded-lg text-left transition ${
                        selectedSociety?.id === society.id
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      <h3 className="font-semibold text-lg">{society.name}</h3>
                      <p className="text-gray-600 text-sm mt-1">
                        {society.address}, {society.city}
                      </p>
                      <p className="text-gray-500 text-sm mt-1">
                        {society.totalBlocks} Blocks • {society.totalFlats} Flats
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Block Selection */}
          {currentStep === 'block' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Select Block/Tower</h2>
              {loadingBlocks ? (
                <div className="text-center py-8">Loading blocks...</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {blocks?.map((block: any) => (
                    <button
                      key={block.id}
                      onClick={() => setSelectedBlock(block)}
                      className={`p-6 border-2 rounded-lg transition ${
                        selectedBlock?.id === block.id
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      <h3 className="font-semibold text-lg">{block.name}</h3>
                      <p className="text-gray-600 text-sm mt-1">{block.totalFlats} Flats</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Flat Selection */}
          {currentStep === 'flat' && (
            <div>
              <h2 className="text-2xl font-bold mb-6 flex items-center">
                <Home className="w-6 h-6 mr-2" />
                Select Your Flat
              </h2>
              {loadingFlats ? (
                <div className="text-center py-8">Loading flats...</div>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                  {flats?.map((flat: any) => (
                    <button
                      key={flat.id}
                      onClick={() => setSelectedFlat(flat)}
                      disabled={!flat.canApply}
                      className={`p-4 border-2 rounded-lg transition ${
                        selectedFlat?.id === flat.id
                          ? 'border-indigo-600 bg-indigo-50'
                          : flat.canApply
                          ? 'border-gray-200 hover:border-indigo-300'
                          : 'border-gray-100 bg-gray-50 cursor-not-allowed'
                      }`}
                    >
                      <p className="font-semibold">{flat.flatNumber}</p>
                      {flat.hasOwner && (
                        <span className="text-xs text-gray-500">Owner exists</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Role Selection */}
          {currentStep === 'role' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Are you an Owner or Tenant?</h2>
              <div className="grid grid-cols-2 gap-6">
                <button
                  onClick={() => setResidentType('OWNER')}
                  className={`p-8 border-2 rounded-xl transition ${
                    residentType === 'OWNER'
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  <h3 className="text-xl font-semibold mb-2">Owner</h3>
                  <p className="text-gray-600 text-sm">I own this property</p>
                </button>
                <button
                  onClick={() => setResidentType('TENANT')}
                  className={`p-8 border-2 rounded-xl transition ${
                    residentType === 'TENANT'
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  <h3 className="text-xl font-semibold mb-2">Tenant</h3>
                  <p className="text-gray-600 text-sm">I rent this property</p>
                </button>
              </div>
            </div>
          )}

          {/* Document Upload */}
          {currentStep === 'documents' && (
            <div>
              <h2 className="text-2xl font-bold mb-6 flex items-center">
                <Upload className="w-6 h-6 mr-2" />
                Upload Documents
              </h2>
              <div className="space-y-4">
                {/* Ownership Proof / Tenant Agreement */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <label className="block">
                    <span className="font-semibold mb-2 block">
                      {residentType === 'OWNER' ? 'Ownership Proof *' : 'Tenant Agreement *'}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) =>
                        handleFileUpload(
                          e,
                          residentType === 'OWNER' ? 'OWNERSHIP_PROOF' : 'TENANT_AGREEMENT'
                        )
                      }
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                    {documents.find((d) =>
                      d.type === (residentType === 'OWNER' ? 'OWNERSHIP_PROOF' : 'TENANT_AGREEMENT')
                    ) && (
                      <p className="text-green-600 text-sm mt-2 flex items-center">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Uploaded successfully
                      </p>
                    )}
                  </label>
                </div>

                {/* ID Proof */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <label className="block">
                    <span className="font-semibold mb-2 block">Aadhar Card *</span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileUpload(e, 'AADHAR_CARD')}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                    {documents.find((d) => d.type === 'AADHAR_CARD') && (
                      <p className="text-green-600 text-sm mt-2 flex items-center">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Uploaded successfully
                      </p>
                    )}
                  </label>
                </div>
              </div>
              {uploading && <p className="text-center text-gray-600 mt-4">Uploading...</p>}
            </div>
          )}

          {/* Submit Confirmation */}
          {currentStep === 'submit' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Review & Submit</h2>
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Society</p>
                  <p className="font-semibold">{selectedSociety?.name}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Block</p>
                  <p className="font-semibold">{selectedBlock?.name}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Flat</p>
                  <p className="font-semibold">{selectedFlat?.flatNumber}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Resident Type</p>
                  <p className="font-semibold">{residentType}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Documents</p>
                  <ul className="mt-2 space-y-1">
                    {documents.map((doc) => (
                      <li key={doc.type} className="text-sm flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                        {doc.type.replace(/_/g, ' ')}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
                className="w-full mt-6 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {submitMutation.isPending ? 'Submitting...' : 'Submit Onboarding Request'}
              </button>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            <button
              onClick={prevStep}
              disabled={currentStep === 'society'}
              className="flex items-center px-6 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </button>
            {currentStep !== 'submit' && (
              <button
                onClick={nextStep}
                disabled={!canProceed()}
                className="flex items-center px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ArrowRight className="w-5 h-5 ml-2" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
