import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Upload, AlertTriangle, ArrowRight, CheckCircle2, FileText } from 'lucide-react';
import { api, extractApiError } from '../lib/api';

interface DiagnosisResult {
  problemTitle: string;
  possibleIssues: string[];
  suggestedCategory: string;
  suggestedCategorySlug: string;
  estimatedDuration: string;
  recommendedNextStep: string;
  preliminaryGuidance: string[];
  safetyNotice: string;
  uncertaintyDisclaimer: string;
}

interface StructuredJob {
  problemTitle: string;
  issueDescription: string;
  serviceCategory: string;
  reportedSymptoms: string[];
  customerRequirements: string;
  technicianNotes: string;
}

export function AIAssistantPage() {
  const navigate = useNavigate();
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [jobDesc, setJobDesc] = useState<StructuredJob | null>(null);
  const [jobLoading, setJobLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please select a JPEG, PNG, or WebP image.');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(String(reader.result));
    reader.readAsDataURL(file);
    setError(null);
  };

  const handleDiagnose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() && !imageFile) {
      setError('Describe the home repair issue or upload an appliance/damage photo.');
      return;
    }
    setLoading(true);
    setError(null);
    setDiagnosis(null);
    setJobDesc(null);

    try {
      const formData = new FormData();
      formData.append('description', description.trim());
      if (imageFile) {
        formData.append('image', imageFile);
      }

      const { data } = await api.post<{ diagnosis: DiagnosisResult }>('/ai/diagnose', formData);
      setDiagnosis(data.diagnosis);
    } catch (err) {
      setError(extractApiError(err, 'AI Repair Assistant could not analyze the request.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateJobDescription = async () => {
    if (!diagnosis && !description.trim()) return;
    setJobLoading(true);
    try {
      const { data } = await api.post<{ jobDescription: StructuredJob }>('/ai/job-description', {
        rawProblem: description || diagnosis?.problemTitle,
        category: diagnosis?.suggestedCategory,
      });
      setJobDesc(data.jobDescription);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setJobLoading(false);
    }
  };

  const proceedToBooking = () => {
    const slug = diagnosis?.suggestedCategorySlug || 'appliance-repair';
    const payload = {
      category: slug,
      problemTitle: jobDesc?.problemTitle || diagnosis?.problemTitle || 'Home Repair Request',
      problemDescription: jobDesc?.issueDescription || description,
      symptoms: jobDesc?.reportedSymptoms || diagnosis?.possibleIssues || [],
      customerRequirements: jobDesc?.customerRequirements || '',
      technicianNotes: jobDesc?.technicianNotes || '',
    };
    sessionStorage.setItem('fixmate_ai_draft', JSON.stringify(payload));
    navigate(`/explore?category=${encodeURIComponent(slug)}`);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <p className="text-xs font-semibold text-electric-600 inline-flex items-center gap-1.5">
          <Sparkles className="w-4 h-4" />
          Gemini Multimodal Repair Triage
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy-900 mt-1">
          AI Repair Assistant
        </h1>
        <p className="text-sm text-slate-600 mt-1.5 max-w-2xl">
          Describe a symptom or upload a photo of the affected appliance or fixture. Receive likely explanations,
          suggested specialist category, safe preliminary checks, and a ready-to-book job summary.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <form
          onSubmit={handleDiagnose}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-5"
        >
          <div>
            <label className="block text-sm font-semibold text-navy-900 mb-1.5">
              Describe the problem
            </label>
            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='Example: "My split AC is running and blowing air, but the room is not cooling and water drips from the indoor unit."'
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-electric-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-navy-900 mb-1.5">
              Upload photo of appliance or issue (optional)
            </label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-5 cursor-pointer hover:border-electric-500 hover:bg-slate-50 transition-colors">
              <Upload className="w-6 h-6 text-slate-400 mb-2" />
              <span className="text-xs font-medium text-slate-700">
                {imageFile ? imageFile.name : 'Click to choose JPEG, PNG, or WebP (max 5MB)'}
              </span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
            </label>
            {imagePreview && (
              <div className="mt-3 relative rounded-xl overflow-hidden border border-slate-200">
                <img src={imagePreview} alt="Uploaded repair issue" className="w-full h-44 object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  className="absolute top-2 right-2 px-2.5 py-1 bg-navy-950/80 text-white text-xs rounded-md"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-navy-900 hover:bg-navy-800 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {loading ? 'Analyzing Issue...' : 'Analyze Repair Problem'}
          </button>

          <div className="text-xs text-slate-500 flex flex-wrap gap-2 pt-1">
            <span>Quick examples:</span>
            <button
              type="button"
              onClick={() => setDescription('My split AC is running but not cooling.')}
              className="text-electric-600 hover:underline"
            >
              AC not cooling
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => setDescription('Kitchen sink drain pipe is leaking slowly under the U-bend.')}
              className="text-electric-600 hover:underline"
            >
              Under-sink leak
            </button>
          </div>
        </form>

        {/* Results Panel */}
        <div className="lg:col-span-7 space-y-6">
          {!diagnosis && !loading && (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
              <Sparkles className="w-8 h-8 text-electric-600 mx-auto mb-3" />
              <h2 className="font-display text-lg font-semibold text-navy-900">
                Ready to triage your repair request
              </h2>
              <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                Enter your issue details on the left to receive possible explanations, recommended
                trade category, and safe next steps.
              </p>
            </div>
          )}

          {loading && (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 space-y-4 animate-pulse">
              <div className="h-6 bg-slate-200 rounded w-1/2" />
              <div className="h-4 bg-slate-100 rounded w-3/4" />
              <div className="h-24 bg-slate-100 rounded" />
            </div>
          )}

          {diagnosis && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <p className="text-xs font-medium text-electric-600">
                    Suggested Category: {diagnosis.suggestedCategory}
                  </p>
                  <h2 className="font-display text-xl font-bold text-navy-900 mt-1">
                    {diagnosis.problemTitle}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    Estimated service duration: {diagnosis.estimatedDuration}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={proceedToBooking}
                  className="px-4 py-2.5 bg-accent-500 hover:bg-accent-600 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  Find {diagnosis.suggestedCategory} Pros
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-navy-900 mb-2">Possible Explanations</h3>
                <ul className="space-y-1.5 text-sm text-slate-700 list-disc pl-5">
                  {diagnosis.possibleIssues.map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-navy-900 mb-2">Safe Preliminary Guidance</h3>
                <ul className="space-y-1.5 text-sm text-slate-700">
                  {diagnosis.preliminaryGuidance.map((g, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1.5">
                <p className="font-semibold inline-flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Safety & Diagnostic Notice
                </p>
                <p>{diagnosis.safetyNotice}</p>
                <p className="text-amber-800">{diagnosis.uncertaintyDisclaimer}</p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-600">
                  <span className="font-semibold text-navy-900">Recommended next step:</span>{' '}
                  {diagnosis.recommendedNextStep}
                </p>
                <button
                  type="button"
                  onClick={handleGenerateJobDescription}
                  disabled={jobLoading}
                  className="px-3.5 py-2 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {jobLoading ? 'Formatting...' : 'Generate Structured Job Description'}
                </button>
              </div>
            </div>
          )}

          {jobDesc && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-navy-900">
                  Technician-Ready Job Description
                </h3>
                <button
                  type="button"
                  onClick={proceedToBooking}
                  className="px-4 py-2 bg-navy-900 text-white text-xs font-semibold rounded-lg hover:bg-navy-800"
                >
                  Use in Booking Request
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Problem Title</p>
                  <p className="font-semibold text-navy-900">{jobDesc.problemTitle}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Service Category</p>
                  <p className="font-semibold text-navy-900">{jobDesc.serviceCategory}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-500">Issue Description</p>
                  <p className="text-slate-700 mt-0.5">{jobDesc.issueDescription}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Reported Symptoms</p>
                  <ul className="list-disc pl-4 text-slate-700 mt-0.5 text-xs space-y-0.5">
                    {jobDesc.reportedSymptoms.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Notes for Technician</p>
                  <p className="text-slate-700 mt-0.5 text-xs">{jobDesc.technicianNotes}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
