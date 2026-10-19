package com.cleaneazy.laundry

import android.app.Activity
import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.content.ClipData
import android.os.CancellationSignal
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PageRange
import android.os.ParcelFileDescriptor
import android.webkit.JavascriptInterface
import androidx.core.content.FileProvider
import java.io.File
import java.io.IOException
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.view.Gravity

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var progress: ProgressBar
    private lateinit var loadingMessage: TextView

    companion object {
        private const val APP_URL =
            "https://sangrammahamuni614-hub.github.io/cleaneazy-laundry/software/"
        private const val APP_HOST = "sangrammahamuni614-hub.github.io"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(24, 63, 55)
        window.navigationBarColor = Color.rgb(16, 20, 23)

        val root = FrameLayout(this)
        webView = WebView(this)
        webView.setBackgroundColor(Color.WHITE)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.databaseEnabled = true
        webView.settings.loadsImagesAutomatically = true
        webView.settings.javaScriptCanOpenWindowsAutomatically = false
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val uri = request.url
                if (uri.scheme == "https" && uri.host == APP_HOST) return false
                if (uri.scheme == "https" || uri.scheme == "http") {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    return true
                }
                return true
            }
        }
        webView.webChromeClient = WebChromeClient()
        webView.addJavascriptInterface(InvoiceShareBridge(), "CleanEazyNative")

        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal)
        progress.isIndeterminate = false
        progress.max = 100
        progress.progressTintList = android.content.res.ColorStateList.valueOf(Color.rgb(13, 111, 78))
        progress.layoutParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, dp(3), Gravity.TOP
        )

        loadingMessage = TextView(this)
        loadingMessage.text = "CleanEazy Laundry\nलोड होत आहे…"
        loadingMessage.textSize = 18f
        loadingMessage.setTextColor(Color.rgb(24, 63, 55))
        loadingMessage.gravity = Gravity.CENTER
        loadingMessage.visibility = View.GONE
        loadingMessage.layoutParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        )

        root.addView(webView, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))
        root.addView(loadingMessage)
        root.addView(progress)
        setContentView(root)

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progress.progress = newProgress
                progress.visibility = if (newProgress in 1..99) View.VISIBLE else View.GONE
            }
        }

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            webView.loadUrl(APP_URL)
        }
    }

    private inner class InvoiceShareBridge {
        @JavascriptInterface
        fun shareInvoiceHtml(html: String, requestedName: String) {
            // Only accept a bounded, script-free invoice document from the app's hosted UI.
            if (html.length !in 1..1_000_000 ||
                !html.contains("<html", ignoreCase = true) ||
                Regex("<script|javascript:|on[a-z]+\\s*=", RegexOption.IGNORE_CASE).containsMatchIn(html) ||
                Regex("(src|href)\\s*=\\s*['\"]https?://", RegexOption.IGNORE_CASE).containsMatchIn(html)
            ) {
                runOnUiThread { showShareError("पावती तयार करता आली नाही. पुन्हा प्रयत्न करा.") }
                return
            }
            val safeName = requestedName.replace(Regex("[^A-Za-z0-9._-]"), "_")
                .take(80).ifBlank { "CleanEazy-Invoice" }
            runOnUiThread { renderAndSharePdf(html, safeName) }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun renderAndSharePdf(invoiceHtml: String, filename: String) {
        val pdfWebView = WebView(this)
        pdfWebView.settings.javaScriptEnabled = false
        pdfWebView.settings.allowFileAccess = false
        pdfWebView.settings.allowContentAccess = false
        pdfWebView.setBackgroundColor(Color.WHITE)
        pdfWebView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = true
            override fun onPageFinished(view: WebView, url: String) {
                try {
                    val directory = File(cacheDir, "shared-invoices")
                    if (!directory.exists() && !directory.mkdirs()) throw IOException("cache directory")
                    val pdf = File(directory, "$filename.pdf")
                    val descriptor = ParcelFileDescriptor.open(
                        pdf,
                        ParcelFileDescriptor.MODE_CREATE or ParcelFileDescriptor.MODE_TRUNCATE or ParcelFileDescriptor.MODE_READ_WRITE
                    )
                    val adapter = view.createPrintDocumentAdapter(filename)
                    val attributes = PrintAttributes.Builder()
                        .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                        .setResolution(PrintAttributes.Resolution("cleaneazy", "CleanEazy", 300, 300))
                        .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                        .build()
                    adapter.onLayout(null, attributes, CancellationSignal(),
                        object : PrintDocumentAdapter.LayoutResultCallback() {
                            override fun onLayoutFinished(info: PrintDocumentAdapter.DocumentInfo, changed: Boolean) {
                                adapter.onWrite(arrayOf(PageRange.ALL_PAGES), descriptor, CancellationSignal(),
                                    object : PrintDocumentAdapter.WriteResultCallback() {
                                        override fun onWriteFinished(pages: Array<PageRange>) {
                                            try {
                                                descriptor.close()
                                                val uri = FileProvider.getUriForFile(
                                                    this@MainActivity,
                                                    "$packageName.fileprovider",
                                                    pdf
                                                )
                                                val share = Intent(Intent.ACTION_SEND).apply {
                                                    type = "application/pdf"
                                                    putExtra(Intent.EXTRA_STREAM, uri)
                                                    clipData = ClipData.newUri(contentResolver, "CleanEazy PDF", uri)
                                                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                                }
                                                startActivity(Intent.createChooser(share, "पावती शेअर करा"))
                                            } catch (_: Exception) {
                                                showShareError("PDF शेअर करता आला नाही. पुन्हा प्रयत्न करा.")
                                            } finally {
                                                view.destroy()
                                            }
                                        }
                                        override fun onWriteFailed(error: CharSequence?) {
                                            try { descriptor.close() } catch (_: Exception) {}
                                            showShareError("PDF तयार झाला नाही. प्रिंट पर्याय वापरून पाहा.")
                                            view.destroy()
                                        }
                                    })
                            }
                            override fun onLayoutFailed(error: CharSequence?) {
                                try { descriptor.close() } catch (_: Exception) {}
                                showShareError("पावतीचे PDF तयार करता आले नाही.")
                                view.destroy()
                            }
                        }, Bundle())
                } catch (_: Exception) {
                    showShareError("PDF तयार करता आला नाही. कृपया पुन्हा प्रयत्न करा.")
                    view.destroy()
                }
            }
        }
        pdfWebView.loadDataWithBaseURL(null, invoiceHtml, "text/html", "UTF-8", null)
    }

    private fun showShareError(message: String) {
        android.widget.Toast.makeText(this, message, android.widget.Toast.LENGTH_LONG).show()
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    @Deprecated("Deprecated in Android 13, retained for broad API compatibility")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        if (::webView.isInitialized) webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.webChromeClient = null
            webView.webViewClient = WebViewClient()
            webView.destroy()
        }
        super.onDestroy()
    }
}
