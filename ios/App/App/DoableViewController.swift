import UIKit
import Capacitor

/// The Swift wrapper around Doable: Capacitor's bridge view controller hosts the app (the same screens
/// as on Android), and this subclass adds Doable's own native code.
class DoableViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        // Doable's own Swift plugin (app plugins aren't found automatically like npm ones).
        bridge?.registerPluginInstance(ReminderHelperPlugin())
        // Feel like an app, not a web page: no rubber-band bounce on the whole screen
        // (lists inside the app still scroll normally).
        webView?.scrollView.bounces = false
    }
}
