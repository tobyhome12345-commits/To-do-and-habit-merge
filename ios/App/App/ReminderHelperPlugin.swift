import Foundation
import UIKit
import Capacitor

/// Doable's own native helper on iPhone: the Swift twin of the Android ReminderHelperPlugin.java,
/// so `src/notifications/reliability.ts` works the same on both phones.
///
/// Android needs help to keep reminders alive (Samsung puts "optimized" apps to sleep). iOS doesn't:
/// scheduled notifications are delivered by the system itself, even after Doable is swiped away,
/// so Settings simply shows "Runs in the background ✓", and tapping it opens Doable's iPhone settings.
@objc(ReminderHelperPlugin)
public class ReminderHelperPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ReminderHelperPlugin"
    public let jsName = "ReminderHelper"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestIgnoreBatteryOptimizations", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openAppSettings", returnType: CAPPluginReturnPromise),
    ]

    /// Reminders on iPhone never get held back by battery saving, so this is always true.
    @objc func getStatus(_ call: CAPPluginCall) {
        call.resolve([
            "ignoringBatteryOptimizations": true,
            "manufacturer": "Apple",
        ])
    }

    /// Nothing to ask for on iPhone.
    @objc func requestIgnoreBatteryOptimizations(_ call: CAPPluginCall) {
        call.resolve()
    }

    /// Opens Settings → Doable (notifications, background refresh…).
    @objc func openAppSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: UIApplication.openSettingsURLString) else {
                call.reject("Could not find the Settings app")
                return
            }
            UIApplication.shared.open(url, options: [:]) { _ in call.resolve() }
        }
    }
}
