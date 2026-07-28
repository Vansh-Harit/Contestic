'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AlertCircle, Upload, Link2, X, FileText, Image as ImageIcon, Plus, Loader2 } from 'lucide-react'
import { formatBytes } from '@/lib/utils'
import toast from 'react-hot-toast'

interface AttachedFile {
  type: 'upload' | 'drive_link'
  url: string
  filename: string
  size_bytes: number
}

interface SubmitDialogProps {
  open: boolean
  onClose: () => void
  contestId: string
  aiPolicy: string
  category: string
  onSuccess: () => void
}

export function SubmitDialog({
  open,
  onClose,
  contestId,
  aiPolicy,
  category,
  onSuccess,
}: SubmitDialogProps) {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'upload' | 'link'>('upload')
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [linkInput, setLinkInput] = useState('')
  const [labelInput, setLabelInput] = useState('')

  const charCount = content.length
  const isValid = charCount <= 5000 && (charCount > 0 || attachedFiles.length > 0)

  const totalUploadSize = attachedFiles
    .filter(f => f.type === 'upload')
    .reduce((sum, f) => sum + f.size_bytes, 0)

  const getHelperText = () => {
    if (category === 'Design') return 'Upload your design as JPG, PNG, or PDF. Max 20MB total.'
    if (category === 'Content Writing') return 'Format your content as a PDF and upload it here. Max 20MB.'
    return 'Upload a supporting file (JPG, PNG, or PDF). Max 20MB.'
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 20 * 1024 * 1024) {
      toast.error('File exceeds 20MB. Please use the Drive Link option instead.')
      e.target.value = ''
      return
    }

    // Check total size
    if (totalUploadSize + file.size > 20 * 1024 * 1024) {
      toast.error('Total upload size would exceed 20MB. Use a Drive link for additional files.')
      e.target.value = ''
      return
    }

    setSelectedFile(file)
  }

  const handleUploadFile = async () => {
    if (!selectedFile) return

    setUploading(true)
    try {
      const res = await fetch(`/api/contests/${contestId}/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: selectedFile.name,
          contentType: selectedFile.type,
          fileSize: selectedFile.size,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Upload failed')
        setUploading(false)
        return
      }

      const { uploadUrl, publicUrl } = await res.json()

      // Upload directly to R2 using XMLHttpRequest to track progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl, true)
        xhr.setRequestHeader('Content-Type', selectedFile.type)

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100)
            setUploadProgress(percentComplete)
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        }

        xhr.onerror = () => reject(new Error('Network error occurred during upload'))
        xhr.send(selectedFile)
      })

      setAttachedFiles(prev => [...prev, {
        type: 'upload',
        url: publicUrl,
        filename: selectedFile.name,
        size_bytes: selectedFile.size,
      }])

      setSelectedFile(null)
      // Reset file input
      const fileInput = document.getElementById('file-upload-input') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      toast.success('File uploaded')
    } catch (err) {
      toast.error('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleAddLink = () => {
    const url = linkInput.trim()
    if (!url) {
      toast.error('Please enter a URL')
      return
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      toast.error('Please enter a valid URL starting with http:// or https://')
      return
    }

    setAttachedFiles(prev => [...prev, {
      type: 'drive_link',
      url,
      filename: labelInput.trim() || 'Drive Link',
      size_bytes: 0,
    }])

    setLinkInput('')
    setLabelInput('')
    toast.success('Link added')
  }

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    const finalFiles = [...attachedFiles]

    // If there is an un-added link in the input, auto-add it
    if (linkInput.trim()) {
      const url = linkInput.trim()
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        toast.error('Please fix your link to start with http:// or https://, or clear the input to submit without it.')
        return
      }
      finalFiles.push({
        type: 'drive_link',
        url,
        filename: labelInput.trim() || 'Drive Link',
        size_bytes: 0,
      })
    }

    // If there is a selected file that hasn't been uploaded
    if (selectedFile) {
      toast.error('You have selected a file but not uploaded it. Please click "Add to submission" first or remove it.')
      return
    }

    // Re-check validity based on final files
    if (content.length === 0 && finalFiles.length === 0) {
      toast.error('Please provide a description, link, or file.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/contests/${contestId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          file_urls: finalFiles,
        }),
      })
      if (res.ok) {
        toast.success('Submission received! Good luck.')
        onSuccess()
        onClose()
        // Reset state
        setContent('')
        setAttachedFiles([])
        setSelectedFile(null)
      } else {
        const err = await res.json()
        toast.error(err.error || 'Submission failed')
      }
    } catch (err) {
      toast.error('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-2xl bg-surface-container-lowest border-outline-variant font-sans max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-headline-sm font-heading font-bold text-on-surface">
            Submit Your Entry
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Text Description */}
          <div className="space-y-2">
            <Label className="text-label-caps uppercase tracking-wider text-secondary font-bold text-xs">
              Your Submission (Optional)
            </Label>
            <Textarea
              placeholder="Describe about your creative work"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[180px] resize-y bg-transparent border-outline-variant focus:border-primary-container"
            />
            <div className="flex justify-between text-xs font-semibold">
              <span
                className={
                  charCount > 5000
                    ? 'text-error'
                    : 'text-secondary'
                }
              >
                {charCount} / 5000 characters
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-outline-variant" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-surface-container-lowest px-3 text-secondary font-medium">
                Add files or links (optional)
              </span>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex gap-1 bg-surface-container rounded-lg p-1">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-all cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              <Upload className="h-4 w-4" />
              Upload File
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('link')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-all cursor-pointer ${
                activeTab === 'link'
                  ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              <Link2 className="h-4 w-4" />
              Add Drive Link
            </button>
          </div>

          {/* Upload File Tab */}
          {activeTab === 'upload' && (
            <div className="space-y-3">
              <p className="text-xs text-secondary">{getHelperText()}</p>

              <div className="border-2 border-dashed border-outline-variant rounded-lg p-6 text-center hover:border-primary-container transition-colors">
                <input
                  id="file-upload-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={uploading}
                />
                <label
                  htmlFor="file-upload-input"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="h-8 w-8 text-secondary" />
                  <span className="text-sm font-medium text-secondary">
                    Click to select a file
                  </span>
                  <span className="text-xs text-secondary/70">
                    JPG, PNG, WebP, or PDF up to 20MB
                  </span>
                </label>
              </div>

              {/* Selected file preview */}
              {selectedFile && (
                <div className="flex items-center justify-between bg-surface-container rounded-lg p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {selectedFile.type.startsWith('image/') ? (
                      <ImageIcon className="h-5 w-5 text-primary shrink-0" />
                    ) : (
                      <FileText className="h-5 w-5 text-red-600 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-on-surface truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-secondary">
                        {formatBytes(selectedFile.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null)
                        const fileInput = document.getElementById('file-upload-input') as HTMLInputElement
                        if (fileInput) fileInput.value = ''
                      }}
                      className="p-1 text-secondary hover:text-error transition-colors cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <Button
                      size="sm"
                      onClick={handleUploadFile}
                      disabled={uploading}
                      className="bg-primary-container text-on-primary-container font-bold hover:opacity-90 text-xs"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          Uploading {uploadProgress}%
                        </>
                      ) : (
                        'Add to submission'
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Total size tracker */}
              {attachedFiles.some(f => f.type === 'upload') && (
                <p className="text-xs text-secondary font-medium">
                  Files: {formatBytes(totalUploadSize)} / 20 MB
                </p>
              )}
            </div>
          )}

          {/* Add Drive Link Tab */}
          {activeTab === 'link' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-transparent border border-outline-variant rounded-lg focus:outline-none focus:border-primary-container transition-colors"
                />
                <input
                  type="text"
                  placeholder="Label (optional, e.g. 'Scene 1 footage')"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-transparent border border-outline-variant rounded-lg focus:outline-none focus:border-primary-container transition-colors"
                />
                <Button
                  size="sm"
                  onClick={handleAddLink}
                  className="bg-primary-container text-on-primary-container font-bold hover:opacity-90 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Link
                </Button>
              </div>
            </div>
          )}

          {/* Attached files list */}
          {attachedFiles.length > 0 && (
            <div className="space-y-2">
              <Label className="text-label-caps uppercase tracking-wider text-secondary font-bold text-xs">
                Attached ({attachedFiles.length})
              </Label>
              <div className="space-y-1.5">
                {attachedFiles.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-surface-container rounded-lg px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {file.type === 'upload' ? (
                        file.filename.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                          <ImageIcon className="h-4 w-4 text-primary shrink-0" />
                        ) : (
                          <FileText className="h-4 w-4 text-red-600 shrink-0" />
                        )
                      ) : (
                        <Link2 className="h-4 w-4 text-blue-600 shrink-0" />
                      )}
                      <span className="text-sm text-on-surface truncate">
                        {file.filename}
                      </span>
                      {file.type === 'upload' && file.size_bytes > 0 && (
                        <span className="text-xs text-secondary shrink-0">
                          ({formatBytes(file.size_bytes)})
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="p-1 text-secondary hover:text-error transition-colors cursor-pointer shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Policy */}
          <div className="bg-primary-container/5 border border-primary-container/20 p-4 rounded-lg flex items-start gap-4">
            <AlertCircle className="h-5 w-5 text-primary-container shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-primary mb-1">
                AI Policy: {aiPolicy.toUpperCase()}
              </h4>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                {aiPolicy === 'none' &&
                  'Strict No-AI Policy. Submissions using generative tools will be disqualified.'}
                {aiPolicy === 'partial' &&
                  'AI may be used for brainstorming or outlining, but the final submission must be heavily edited and human-crafted.'}
                {aiPolicy === 'allowed' &&
                  'AI assistance is permitted for this contest.'}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4 pt-4 border-t border-outline-variant">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting || uploading}
              className="border-outline-variant text-secondary hover:text-on-surface"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting || uploading}
              className="bg-primary-container text-on-primary-container font-bold hover:opacity-90 transition-opacity"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Entry'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
