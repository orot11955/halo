import Foundation

#if canImport(Security)
import Security
#endif

public enum KeychainSessionError: Error, Equatable {
    case unavailable
    case unexpectedStatus(Int32)
}

public final class KeychainSessionStore: SessionStoring {
    private let service: String

    public init(service: String = "halo.session") {
        self.service = service
    }

    public func read(origin: String) throws -> SessionToken? {
        #if canImport(Security)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: origin,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound {
            return nil
        }
        guard status == errSecSuccess else {
            throw KeychainSessionError.unexpectedStatus(status)
        }
        guard let data = item as? Data else {
            return nil
        }
        return try HaloJSON.decoder.decode(SessionToken.self, from: data)
        #else
        throw KeychainSessionError.unavailable
        #endif
    }

    public func save(_ session: SessionToken, origin: String) throws {
        #if canImport(Security)
        let data = try HaloJSON.encoder.encode(session)
        let baseQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: origin,
        ]
        let updateAttributes: [String: Any] = [
            kSecValueData as String: data,
        ]
        let status = SecItemUpdate(baseQuery as CFDictionary, updateAttributes as CFDictionary)
        if status == errSecItemNotFound {
            var addQuery = baseQuery
            addQuery[kSecValueData as String] = data
            addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
            guard addStatus == errSecSuccess else {
                throw KeychainSessionError.unexpectedStatus(addStatus)
            }
            return
        }
        guard status == errSecSuccess else {
            throw KeychainSessionError.unexpectedStatus(status)
        }
        #else
        throw KeychainSessionError.unavailable
        #endif
    }

    public func delete(origin: String) throws {
        #if canImport(Security)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: origin,
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainSessionError.unexpectedStatus(status)
        }
        #else
        throw KeychainSessionError.unavailable
        #endif
    }
}
