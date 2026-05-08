import * as $protobuf from "protobufjs";
import Long = require("long");
/** Namespace rntme. */
export namespace rntme {

    /** Namespace contracts. */
    namespace contracts {

        /** Namespace storage. */
        namespace storage {

            /** Namespace v1. */
            namespace v1 {

                /** Properties of a FileUploadInitiated. */
                interface IFileUploadInitiated {

                    /** FileUploadInitiated file_id */
                    file_id?: (string|null);

                    /** FileUploadInitiated route_id */
                    route_id?: (string|null);

                    /** FileUploadInitiated entity_id */
                    entity_id?: (string|null);

                    /** FileUploadInitiated owner_principal_id */
                    owner_principal_id?: (string|null);

                    /** FileUploadInitiated content_type */
                    content_type?: (string|null);

                    /** FileUploadInitiated declared_size */
                    declared_size?: (number|Long|null);

                    /** FileUploadInitiated expires_at */
                    expires_at?: (google.protobuf.ITimestamp|null);
                }

                /** Represents a FileUploadInitiated. */
                class FileUploadInitiated implements IFileUploadInitiated {

                    /**
                     * Constructs a new FileUploadInitiated.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.storage.v1.IFileUploadInitiated);

                    /** FileUploadInitiated file_id. */
                    public file_id: string;

                    /** FileUploadInitiated route_id. */
                    public route_id: string;

                    /** FileUploadInitiated entity_id. */
                    public entity_id: string;

                    /** FileUploadInitiated owner_principal_id. */
                    public owner_principal_id: string;

                    /** FileUploadInitiated content_type. */
                    public content_type: string;

                    /** FileUploadInitiated declared_size. */
                    public declared_size: (number|Long);

                    /** FileUploadInitiated expires_at. */
                    public expires_at?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a new FileUploadInitiated instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns FileUploadInitiated instance
                     */
                    public static create(properties?: rntme.contracts.storage.v1.IFileUploadInitiated): rntme.contracts.storage.v1.FileUploadInitiated;

                    /**
                     * Encodes the specified FileUploadInitiated message. Does not implicitly {@link rntme.contracts.storage.v1.FileUploadInitiated.verify|verify} messages.
                     * @param message FileUploadInitiated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.storage.v1.IFileUploadInitiated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified FileUploadInitiated message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.FileUploadInitiated.verify|verify} messages.
                     * @param message FileUploadInitiated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.storage.v1.IFileUploadInitiated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a FileUploadInitiated message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns FileUploadInitiated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.storage.v1.FileUploadInitiated;

                    /**
                     * Decodes a FileUploadInitiated message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns FileUploadInitiated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.storage.v1.FileUploadInitiated;

                    /**
                     * Verifies a FileUploadInitiated message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a FileUploadInitiated message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns FileUploadInitiated
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.storage.v1.FileUploadInitiated;

                    /**
                     * Creates a plain object from a FileUploadInitiated message. Also converts values to other types if specified.
                     * @param message FileUploadInitiated
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.storage.v1.FileUploadInitiated, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this FileUploadInitiated to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for FileUploadInitiated
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a FileUploadCommitted. */
                interface IFileUploadCommitted {

                    /** FileUploadCommitted file_id */
                    file_id?: (string|null);

                    /** FileUploadCommitted object_key */
                    object_key?: (string|null);

                    /** FileUploadCommitted sha256 */
                    sha256?: (string|null);

                    /** FileUploadCommitted size_bytes */
                    size_bytes?: (number|Long|null);

                    /** FileUploadCommitted committed_at */
                    committed_at?: (google.protobuf.ITimestamp|null);
                }

                /** Represents a FileUploadCommitted. */
                class FileUploadCommitted implements IFileUploadCommitted {

                    /**
                     * Constructs a new FileUploadCommitted.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.storage.v1.IFileUploadCommitted);

                    /** FileUploadCommitted file_id. */
                    public file_id: string;

                    /** FileUploadCommitted object_key. */
                    public object_key: string;

                    /** FileUploadCommitted sha256. */
                    public sha256: string;

                    /** FileUploadCommitted size_bytes. */
                    public size_bytes: (number|Long);

                    /** FileUploadCommitted committed_at. */
                    public committed_at?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a new FileUploadCommitted instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns FileUploadCommitted instance
                     */
                    public static create(properties?: rntme.contracts.storage.v1.IFileUploadCommitted): rntme.contracts.storage.v1.FileUploadCommitted;

                    /**
                     * Encodes the specified FileUploadCommitted message. Does not implicitly {@link rntme.contracts.storage.v1.FileUploadCommitted.verify|verify} messages.
                     * @param message FileUploadCommitted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.storage.v1.IFileUploadCommitted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified FileUploadCommitted message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.FileUploadCommitted.verify|verify} messages.
                     * @param message FileUploadCommitted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.storage.v1.IFileUploadCommitted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a FileUploadCommitted message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns FileUploadCommitted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.storage.v1.FileUploadCommitted;

                    /**
                     * Decodes a FileUploadCommitted message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns FileUploadCommitted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.storage.v1.FileUploadCommitted;

                    /**
                     * Verifies a FileUploadCommitted message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a FileUploadCommitted message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns FileUploadCommitted
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.storage.v1.FileUploadCommitted;

                    /**
                     * Creates a plain object from a FileUploadCommitted message. Also converts values to other types if specified.
                     * @param message FileUploadCommitted
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.storage.v1.FileUploadCommitted, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this FileUploadCommitted to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for FileUploadCommitted
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a FileUploadAborted. */
                interface IFileUploadAborted {

                    /** FileUploadAborted file_id */
                    file_id?: (string|null);

                    /** FileUploadAborted reason */
                    reason?: (string|null);

                    /** FileUploadAborted aborted_at */
                    aborted_at?: (google.protobuf.ITimestamp|null);
                }

                /** Represents a FileUploadAborted. */
                class FileUploadAborted implements IFileUploadAborted {

                    /**
                     * Constructs a new FileUploadAborted.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.storage.v1.IFileUploadAborted);

                    /** FileUploadAborted file_id. */
                    public file_id: string;

                    /** FileUploadAborted reason. */
                    public reason: string;

                    /** FileUploadAborted aborted_at. */
                    public aborted_at?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a new FileUploadAborted instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns FileUploadAborted instance
                     */
                    public static create(properties?: rntme.contracts.storage.v1.IFileUploadAborted): rntme.contracts.storage.v1.FileUploadAborted;

                    /**
                     * Encodes the specified FileUploadAborted message. Does not implicitly {@link rntme.contracts.storage.v1.FileUploadAborted.verify|verify} messages.
                     * @param message FileUploadAborted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.storage.v1.IFileUploadAborted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified FileUploadAborted message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.FileUploadAborted.verify|verify} messages.
                     * @param message FileUploadAborted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.storage.v1.IFileUploadAborted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a FileUploadAborted message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns FileUploadAborted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.storage.v1.FileUploadAborted;

                    /**
                     * Decodes a FileUploadAborted message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns FileUploadAborted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.storage.v1.FileUploadAborted;

                    /**
                     * Verifies a FileUploadAborted message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a FileUploadAborted message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns FileUploadAborted
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.storage.v1.FileUploadAborted;

                    /**
                     * Creates a plain object from a FileUploadAborted message. Also converts values to other types if specified.
                     * @param message FileUploadAborted
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.storage.v1.FileUploadAborted, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this FileUploadAborted to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for FileUploadAborted
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a FileOrphaned. */
                interface IFileOrphaned {

                    /** FileOrphaned file_id */
                    file_id?: (string|null);

                    /** FileOrphaned reason */
                    reason?: (string|null);

                    /** FileOrphaned orphaned_at */
                    orphaned_at?: (google.protobuf.ITimestamp|null);
                }

                /** Represents a FileOrphaned. */
                class FileOrphaned implements IFileOrphaned {

                    /**
                     * Constructs a new FileOrphaned.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.storage.v1.IFileOrphaned);

                    /** FileOrphaned file_id. */
                    public file_id: string;

                    /** FileOrphaned reason. */
                    public reason: string;

                    /** FileOrphaned orphaned_at. */
                    public orphaned_at?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a new FileOrphaned instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns FileOrphaned instance
                     */
                    public static create(properties?: rntme.contracts.storage.v1.IFileOrphaned): rntme.contracts.storage.v1.FileOrphaned;

                    /**
                     * Encodes the specified FileOrphaned message. Does not implicitly {@link rntme.contracts.storage.v1.FileOrphaned.verify|verify} messages.
                     * @param message FileOrphaned message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.storage.v1.IFileOrphaned, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified FileOrphaned message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.FileOrphaned.verify|verify} messages.
                     * @param message FileOrphaned message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.storage.v1.IFileOrphaned, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a FileOrphaned message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns FileOrphaned
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.storage.v1.FileOrphaned;

                    /**
                     * Decodes a FileOrphaned message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns FileOrphaned
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.storage.v1.FileOrphaned;

                    /**
                     * Verifies a FileOrphaned message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a FileOrphaned message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns FileOrphaned
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.storage.v1.FileOrphaned;

                    /**
                     * Creates a plain object from a FileOrphaned message. Also converts values to other types if specified.
                     * @param message FileOrphaned
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.storage.v1.FileOrphaned, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this FileOrphaned to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for FileOrphaned
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a FileDeleted. */
                interface IFileDeleted {

                    /** FileDeleted file_id */
                    file_id?: (string|null);

                    /** FileDeleted deleted_by */
                    deleted_by?: (string|null);

                    /** FileDeleted deleted_at */
                    deleted_at?: (google.protobuf.ITimestamp|null);
                }

                /** Represents a FileDeleted. */
                class FileDeleted implements IFileDeleted {

                    /**
                     * Constructs a new FileDeleted.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.storage.v1.IFileDeleted);

                    /** FileDeleted file_id. */
                    public file_id: string;

                    /** FileDeleted deleted_by. */
                    public deleted_by: string;

                    /** FileDeleted deleted_at. */
                    public deleted_at?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a new FileDeleted instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns FileDeleted instance
                     */
                    public static create(properties?: rntme.contracts.storage.v1.IFileDeleted): rntme.contracts.storage.v1.FileDeleted;

                    /**
                     * Encodes the specified FileDeleted message. Does not implicitly {@link rntme.contracts.storage.v1.FileDeleted.verify|verify} messages.
                     * @param message FileDeleted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.storage.v1.IFileDeleted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified FileDeleted message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.FileDeleted.verify|verify} messages.
                     * @param message FileDeleted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.storage.v1.IFileDeleted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a FileDeleted message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns FileDeleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.storage.v1.FileDeleted;

                    /**
                     * Decodes a FileDeleted message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns FileDeleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.storage.v1.FileDeleted;

                    /**
                     * Verifies a FileDeleted message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a FileDeleted message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns FileDeleted
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.storage.v1.FileDeleted;

                    /**
                     * Creates a plain object from a FileDeleted message. Also converts values to other types if specified.
                     * @param message FileDeleted
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.storage.v1.FileDeleted, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this FileDeleted to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for FileDeleted
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a FileLifecycleSwept. */
                interface IFileLifecycleSwept {

                    /** FileLifecycleSwept count */
                    count?: (number|null);

                    /** FileLifecycleSwept before_at */
                    before_at?: (google.protobuf.ITimestamp|null);

                    /** FileLifecycleSwept file_ids_sample */
                    file_ids_sample?: (string[]|null);
                }

                /** Represents a FileLifecycleSwept. */
                class FileLifecycleSwept implements IFileLifecycleSwept {

                    /**
                     * Constructs a new FileLifecycleSwept.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.storage.v1.IFileLifecycleSwept);

                    /** FileLifecycleSwept count. */
                    public count: number;

                    /** FileLifecycleSwept before_at. */
                    public before_at?: (google.protobuf.ITimestamp|null);

                    /** FileLifecycleSwept file_ids_sample. */
                    public file_ids_sample: string[];

                    /**
                     * Creates a new FileLifecycleSwept instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns FileLifecycleSwept instance
                     */
                    public static create(properties?: rntme.contracts.storage.v1.IFileLifecycleSwept): rntme.contracts.storage.v1.FileLifecycleSwept;

                    /**
                     * Encodes the specified FileLifecycleSwept message. Does not implicitly {@link rntme.contracts.storage.v1.FileLifecycleSwept.verify|verify} messages.
                     * @param message FileLifecycleSwept message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.storage.v1.IFileLifecycleSwept, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified FileLifecycleSwept message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.FileLifecycleSwept.verify|verify} messages.
                     * @param message FileLifecycleSwept message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.storage.v1.IFileLifecycleSwept, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a FileLifecycleSwept message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns FileLifecycleSwept
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.storage.v1.FileLifecycleSwept;

                    /**
                     * Decodes a FileLifecycleSwept message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns FileLifecycleSwept
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.storage.v1.FileLifecycleSwept;

                    /**
                     * Verifies a FileLifecycleSwept message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a FileLifecycleSwept message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns FileLifecycleSwept
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.storage.v1.FileLifecycleSwept;

                    /**
                     * Creates a plain object from a FileLifecycleSwept message. Also converts values to other types if specified.
                     * @param message FileLifecycleSwept
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.storage.v1.FileLifecycleSwept, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this FileLifecycleSwept to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for FileLifecycleSwept
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** FileState enum. */
                enum FileState {
                    FILE_STATE_UNSPECIFIED = 0,
                    FILE_STATE_PENDING = 1,
                    FILE_STATE_COMMITTED = 2,
                    FILE_STATE_ABORTED = 3,
                    FILE_STATE_DELETED = 4,
                    FILE_STATE_VENDOR_SPECIFIC = 100
                }

                /** Properties of a FileMetadata. */
                interface IFileMetadata {

                    /** FileMetadata file_id */
                    file_id?: (string|null);

                    /** FileMetadata route_id */
                    route_id?: (string|null);

                    /** FileMetadata entity_id */
                    entity_id?: (string|null);

                    /** FileMetadata owner_principal_id */
                    owner_principal_id?: (string|null);

                    /** FileMetadata state */
                    state?: (rntme.contracts.storage.v1.FileState|null);

                    /** FileMetadata content_type */
                    content_type?: (string|null);

                    /** FileMetadata declared_size */
                    declared_size?: (number|Long|null);

                    /** FileMetadata actual_size */
                    actual_size?: (number|Long|null);

                    /** FileMetadata sha256 */
                    sha256?: (string|null);

                    /** FileMetadata object_key */
                    object_key?: (string|null);

                    /** FileMetadata initiated_at */
                    initiated_at?: (google.protobuf.ITimestamp|null);

                    /** FileMetadata expires_at */
                    expires_at?: (google.protobuf.ITimestamp|null);

                    /** FileMetadata committed_at */
                    committed_at?: (google.protobuf.ITimestamp|null);

                    /** FileMetadata deleted_at */
                    deleted_at?: (google.protobuf.ITimestamp|null);
                }

                /** Represents a FileMetadata. */
                class FileMetadata implements IFileMetadata {

                    /**
                     * Constructs a new FileMetadata.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.storage.v1.IFileMetadata);

                    /** FileMetadata file_id. */
                    public file_id: string;

                    /** FileMetadata route_id. */
                    public route_id: string;

                    /** FileMetadata entity_id. */
                    public entity_id: string;

                    /** FileMetadata owner_principal_id. */
                    public owner_principal_id: string;

                    /** FileMetadata state. */
                    public state: rntme.contracts.storage.v1.FileState;

                    /** FileMetadata content_type. */
                    public content_type: string;

                    /** FileMetadata declared_size. */
                    public declared_size: (number|Long);

                    /** FileMetadata actual_size. */
                    public actual_size: (number|Long);

                    /** FileMetadata sha256. */
                    public sha256: string;

                    /** FileMetadata object_key. */
                    public object_key: string;

                    /** FileMetadata initiated_at. */
                    public initiated_at?: (google.protobuf.ITimestamp|null);

                    /** FileMetadata expires_at. */
                    public expires_at?: (google.protobuf.ITimestamp|null);

                    /** FileMetadata committed_at. */
                    public committed_at?: (google.protobuf.ITimestamp|null);

                    /** FileMetadata deleted_at. */
                    public deleted_at?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a new FileMetadata instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns FileMetadata instance
                     */
                    public static create(properties?: rntme.contracts.storage.v1.IFileMetadata): rntme.contracts.storage.v1.FileMetadata;

                    /**
                     * Encodes the specified FileMetadata message. Does not implicitly {@link rntme.contracts.storage.v1.FileMetadata.verify|verify} messages.
                     * @param message FileMetadata message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.storage.v1.IFileMetadata, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified FileMetadata message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.FileMetadata.verify|verify} messages.
                     * @param message FileMetadata message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.storage.v1.IFileMetadata, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a FileMetadata message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns FileMetadata
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.storage.v1.FileMetadata;

                    /**
                     * Decodes a FileMetadata message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns FileMetadata
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.storage.v1.FileMetadata;

                    /**
                     * Verifies a FileMetadata message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a FileMetadata message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns FileMetadata
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.storage.v1.FileMetadata;

                    /**
                     * Creates a plain object from a FileMetadata message. Also converts values to other types if specified.
                     * @param message FileMetadata
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.storage.v1.FileMetadata, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this FileMetadata to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for FileMetadata
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a PresignedRequest. */
                interface IPresignedRequest {

                    /** PresignedRequest url */
                    url?: (string|null);

                    /** PresignedRequest headers */
                    headers?: ({ [k: string]: string }|null);

                    /** PresignedRequest expires_at */
                    expires_at?: (google.protobuf.ITimestamp|null);
                }

                /** Represents a PresignedRequest. */
                class PresignedRequest implements IPresignedRequest {

                    /**
                     * Constructs a new PresignedRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.storage.v1.IPresignedRequest);

                    /** PresignedRequest url. */
                    public url: string;

                    /** PresignedRequest headers. */
                    public headers: { [k: string]: string };

                    /** PresignedRequest expires_at. */
                    public expires_at?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a new PresignedRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns PresignedRequest instance
                     */
                    public static create(properties?: rntme.contracts.storage.v1.IPresignedRequest): rntme.contracts.storage.v1.PresignedRequest;

                    /**
                     * Encodes the specified PresignedRequest message. Does not implicitly {@link rntme.contracts.storage.v1.PresignedRequest.verify|verify} messages.
                     * @param message PresignedRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.storage.v1.IPresignedRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified PresignedRequest message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.PresignedRequest.verify|verify} messages.
                     * @param message PresignedRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.storage.v1.IPresignedRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a PresignedRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns PresignedRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.storage.v1.PresignedRequest;

                    /**
                     * Decodes a PresignedRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns PresignedRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.storage.v1.PresignedRequest;

                    /**
                     * Verifies a PresignedRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a PresignedRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns PresignedRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.storage.v1.PresignedRequest;

                    /**
                     * Creates a plain object from a PresignedRequest message. Also converts values to other types if specified.
                     * @param message PresignedRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.storage.v1.PresignedRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this PresignedRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for PresignedRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a PrepareUploadRequest. */
                interface IPrepareUploadRequest {

                    /** PrepareUploadRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** PrepareUploadRequest route_id */
                    route_id?: (string|null);

                    /** PrepareUploadRequest entity_id */
                    entity_id?: (string|null);

                    /** PrepareUploadRequest filename */
                    filename?: (string|null);

                    /** PrepareUploadRequest content_type */
                    content_type?: (string|null);

                    /** PrepareUploadRequest declared_size */
                    declared_size?: (number|Long|null);
                }

                /** Represents a PrepareUploadRequest. */
                class PrepareUploadRequest implements IPrepareUploadRequest {

                    /**
                     * Constructs a new PrepareUploadRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.storage.v1.IPrepareUploadRequest);

                    /** PrepareUploadRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** PrepareUploadRequest route_id. */
                    public route_id: string;

                    /** PrepareUploadRequest entity_id. */
                    public entity_id: string;

                    /** PrepareUploadRequest filename. */
                    public filename: string;

                    /** PrepareUploadRequest content_type. */
                    public content_type: string;

                    /** PrepareUploadRequest declared_size. */
                    public declared_size: (number|Long);

                    /**
                     * Creates a new PrepareUploadRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns PrepareUploadRequest instance
                     */
                    public static create(properties?: rntme.contracts.storage.v1.IPrepareUploadRequest): rntme.contracts.storage.v1.PrepareUploadRequest;

                    /**
                     * Encodes the specified PrepareUploadRequest message. Does not implicitly {@link rntme.contracts.storage.v1.PrepareUploadRequest.verify|verify} messages.
                     * @param message PrepareUploadRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.storage.v1.IPrepareUploadRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified PrepareUploadRequest message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.PrepareUploadRequest.verify|verify} messages.
                     * @param message PrepareUploadRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.storage.v1.IPrepareUploadRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a PrepareUploadRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns PrepareUploadRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.storage.v1.PrepareUploadRequest;

                    /**
                     * Decodes a PrepareUploadRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns PrepareUploadRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.storage.v1.PrepareUploadRequest;

                    /**
                     * Verifies a PrepareUploadRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a PrepareUploadRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns PrepareUploadRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.storage.v1.PrepareUploadRequest;

                    /**
                     * Creates a plain object from a PrepareUploadRequest message. Also converts values to other types if specified.
                     * @param message PrepareUploadRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.storage.v1.PrepareUploadRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this PrepareUploadRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for PrepareUploadRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a PrepareUploadResponse. */
                interface IPrepareUploadResponse {

                    /** PrepareUploadResponse file_id */
                    file_id?: (string|null);

                    /** PrepareUploadResponse object_key */
                    object_key?: (string|null);

                    /** PrepareUploadResponse presigned */
                    presigned?: (rntme.contracts.storage.v1.IPresignedRequest|null);
                }

                /** Represents a PrepareUploadResponse. */
                class PrepareUploadResponse implements IPrepareUploadResponse {

                    /**
                     * Constructs a new PrepareUploadResponse.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.storage.v1.IPrepareUploadResponse);

                    /** PrepareUploadResponse file_id. */
                    public file_id: string;

                    /** PrepareUploadResponse object_key. */
                    public object_key: string;

                    /** PrepareUploadResponse presigned. */
                    public presigned?: (rntme.contracts.storage.v1.IPresignedRequest|null);

                    /**
                     * Creates a new PrepareUploadResponse instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns PrepareUploadResponse instance
                     */
                    public static create(properties?: rntme.contracts.storage.v1.IPrepareUploadResponse): rntme.contracts.storage.v1.PrepareUploadResponse;

                    /**
                     * Encodes the specified PrepareUploadResponse message. Does not implicitly {@link rntme.contracts.storage.v1.PrepareUploadResponse.verify|verify} messages.
                     * @param message PrepareUploadResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.storage.v1.IPrepareUploadResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified PrepareUploadResponse message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.PrepareUploadResponse.verify|verify} messages.
                     * @param message PrepareUploadResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.storage.v1.IPrepareUploadResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a PrepareUploadResponse message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns PrepareUploadResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.storage.v1.PrepareUploadResponse;

                    /**
                     * Decodes a PrepareUploadResponse message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns PrepareUploadResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.storage.v1.PrepareUploadResponse;

                    /**
                     * Verifies a PrepareUploadResponse message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a PrepareUploadResponse message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns PrepareUploadResponse
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.storage.v1.PrepareUploadResponse;

                    /**
                     * Creates a plain object from a PrepareUploadResponse message. Also converts values to other types if specified.
                     * @param message PrepareUploadResponse
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.storage.v1.PrepareUploadResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this PrepareUploadResponse to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for PrepareUploadResponse
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CommitUploadRequest. */
                interface ICommitUploadRequest {

                    /** CommitUploadRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CommitUploadRequest file_id */
                    file_id?: (string|null);
                }

                /** Represents a CommitUploadRequest. */
                class CommitUploadRequest implements ICommitUploadRequest {

                    /**
                     * Constructs a new CommitUploadRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.storage.v1.ICommitUploadRequest);

                    /** CommitUploadRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CommitUploadRequest file_id. */
                    public file_id: string;

                    /**
                     * Creates a new CommitUploadRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CommitUploadRequest instance
                     */
                    public static create(properties?: rntme.contracts.storage.v1.ICommitUploadRequest): rntme.contracts.storage.v1.CommitUploadRequest;

                    /**
                     * Encodes the specified CommitUploadRequest message. Does not implicitly {@link rntme.contracts.storage.v1.CommitUploadRequest.verify|verify} messages.
                     * @param message CommitUploadRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.storage.v1.ICommitUploadRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CommitUploadRequest message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.CommitUploadRequest.verify|verify} messages.
                     * @param message CommitUploadRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.storage.v1.ICommitUploadRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CommitUploadRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CommitUploadRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.storage.v1.CommitUploadRequest;

                    /**
                     * Decodes a CommitUploadRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CommitUploadRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.storage.v1.CommitUploadRequest;

                    /**
                     * Verifies a CommitUploadRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CommitUploadRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CommitUploadRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.storage.v1.CommitUploadRequest;

                    /**
                     * Creates a plain object from a CommitUploadRequest message. Also converts values to other types if specified.
                     * @param message CommitUploadRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.storage.v1.CommitUploadRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CommitUploadRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CommitUploadRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CommitUploadResponse. */
                interface ICommitUploadResponse {

                    /** CommitUploadResponse file */
                    file?: (rntme.contracts.storage.v1.IFileMetadata|null);
                }

                /** Represents a CommitUploadResponse. */
                class CommitUploadResponse implements ICommitUploadResponse {

                    /**
                     * Constructs a new CommitUploadResponse.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.storage.v1.ICommitUploadResponse);

                    /** CommitUploadResponse file. */
                    public file?: (rntme.contracts.storage.v1.IFileMetadata|null);

                    /**
                     * Creates a new CommitUploadResponse instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CommitUploadResponse instance
                     */
                    public static create(properties?: rntme.contracts.storage.v1.ICommitUploadResponse): rntme.contracts.storage.v1.CommitUploadResponse;

                    /**
                     * Encodes the specified CommitUploadResponse message. Does not implicitly {@link rntme.contracts.storage.v1.CommitUploadResponse.verify|verify} messages.
                     * @param message CommitUploadResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.storage.v1.ICommitUploadResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CommitUploadResponse message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.CommitUploadResponse.verify|verify} messages.
                     * @param message CommitUploadResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.storage.v1.ICommitUploadResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CommitUploadResponse message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CommitUploadResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.storage.v1.CommitUploadResponse;

                    /**
                     * Decodes a CommitUploadResponse message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CommitUploadResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.storage.v1.CommitUploadResponse;

                    /**
                     * Verifies a CommitUploadResponse message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CommitUploadResponse message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CommitUploadResponse
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.storage.v1.CommitUploadResponse;

                    /**
                     * Creates a plain object from a CommitUploadResponse message. Also converts values to other types if specified.
                     * @param message CommitUploadResponse
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.storage.v1.CommitUploadResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CommitUploadResponse to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CommitUploadResponse
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an AbortUploadRequest. */
                interface IAbortUploadRequest {

                    /** AbortUploadRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** AbortUploadRequest file_id */
                    file_id?: (string|null);

                    /** AbortUploadRequest reason */
                    reason?: (string|null);
                }

                /** Represents an AbortUploadRequest. */
                class AbortUploadRequest implements IAbortUploadRequest {

                    /**
                     * Constructs a new AbortUploadRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.storage.v1.IAbortUploadRequest);

                    /** AbortUploadRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** AbortUploadRequest file_id. */
                    public file_id: string;

                    /** AbortUploadRequest reason. */
                    public reason: string;

                    /**
                     * Creates a new AbortUploadRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AbortUploadRequest instance
                     */
                    public static create(properties?: rntme.contracts.storage.v1.IAbortUploadRequest): rntme.contracts.storage.v1.AbortUploadRequest;

                    /**
                     * Encodes the specified AbortUploadRequest message. Does not implicitly {@link rntme.contracts.storage.v1.AbortUploadRequest.verify|verify} messages.
                     * @param message AbortUploadRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.storage.v1.IAbortUploadRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AbortUploadRequest message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.AbortUploadRequest.verify|verify} messages.
                     * @param message AbortUploadRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.storage.v1.IAbortUploadRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AbortUploadRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AbortUploadRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.storage.v1.AbortUploadRequest;

                    /**
                     * Decodes an AbortUploadRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AbortUploadRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.storage.v1.AbortUploadRequest;

                    /**
                     * Verifies an AbortUploadRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an AbortUploadRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns AbortUploadRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.storage.v1.AbortUploadRequest;

                    /**
                     * Creates a plain object from an AbortUploadRequest message. Also converts values to other types if specified.
                     * @param message AbortUploadRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.storage.v1.AbortUploadRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this AbortUploadRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for AbortUploadRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an AbortUploadResponse. */
                interface IAbortUploadResponse {

                    /** AbortUploadResponse file */
                    file?: (rntme.contracts.storage.v1.IFileMetadata|null);
                }

                /** Represents an AbortUploadResponse. */
                class AbortUploadResponse implements IAbortUploadResponse {

                    /**
                     * Constructs a new AbortUploadResponse.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.storage.v1.IAbortUploadResponse);

                    /** AbortUploadResponse file. */
                    public file?: (rntme.contracts.storage.v1.IFileMetadata|null);

                    /**
                     * Creates a new AbortUploadResponse instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AbortUploadResponse instance
                     */
                    public static create(properties?: rntme.contracts.storage.v1.IAbortUploadResponse): rntme.contracts.storage.v1.AbortUploadResponse;

                    /**
                     * Encodes the specified AbortUploadResponse message. Does not implicitly {@link rntme.contracts.storage.v1.AbortUploadResponse.verify|verify} messages.
                     * @param message AbortUploadResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.storage.v1.IAbortUploadResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AbortUploadResponse message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.AbortUploadResponse.verify|verify} messages.
                     * @param message AbortUploadResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.storage.v1.IAbortUploadResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AbortUploadResponse message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AbortUploadResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.storage.v1.AbortUploadResponse;

                    /**
                     * Decodes an AbortUploadResponse message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AbortUploadResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.storage.v1.AbortUploadResponse;

                    /**
                     * Verifies an AbortUploadResponse message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an AbortUploadResponse message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns AbortUploadResponse
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.storage.v1.AbortUploadResponse;

                    /**
                     * Creates a plain object from an AbortUploadResponse message. Also converts values to other types if specified.
                     * @param message AbortUploadResponse
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.storage.v1.AbortUploadResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this AbortUploadResponse to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for AbortUploadResponse
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a GetFileRequest. */
                interface IGetFileRequest {

                    /** GetFileRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** GetFileRequest file_id */
                    file_id?: (string|null);
                }

                /** Represents a GetFileRequest. */
                class GetFileRequest implements IGetFileRequest {

                    /**
                     * Constructs a new GetFileRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.storage.v1.IGetFileRequest);

                    /** GetFileRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** GetFileRequest file_id. */
                    public file_id: string;

                    /**
                     * Creates a new GetFileRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns GetFileRequest instance
                     */
                    public static create(properties?: rntme.contracts.storage.v1.IGetFileRequest): rntme.contracts.storage.v1.GetFileRequest;

                    /**
                     * Encodes the specified GetFileRequest message. Does not implicitly {@link rntme.contracts.storage.v1.GetFileRequest.verify|verify} messages.
                     * @param message GetFileRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.storage.v1.IGetFileRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified GetFileRequest message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.GetFileRequest.verify|verify} messages.
                     * @param message GetFileRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.storage.v1.IGetFileRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a GetFileRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns GetFileRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.storage.v1.GetFileRequest;

                    /**
                     * Decodes a GetFileRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns GetFileRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.storage.v1.GetFileRequest;

                    /**
                     * Verifies a GetFileRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a GetFileRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns GetFileRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.storage.v1.GetFileRequest;

                    /**
                     * Creates a plain object from a GetFileRequest message. Also converts values to other types if specified.
                     * @param message GetFileRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.storage.v1.GetFileRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this GetFileRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for GetFileRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a GetFileResponse. */
                interface IGetFileResponse {

                    /** GetFileResponse file */
                    file?: (rntme.contracts.storage.v1.IFileMetadata|null);
                }

                /** Represents a GetFileResponse. */
                class GetFileResponse implements IGetFileResponse {

                    /**
                     * Constructs a new GetFileResponse.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.storage.v1.IGetFileResponse);

                    /** GetFileResponse file. */
                    public file?: (rntme.contracts.storage.v1.IFileMetadata|null);

                    /**
                     * Creates a new GetFileResponse instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns GetFileResponse instance
                     */
                    public static create(properties?: rntme.contracts.storage.v1.IGetFileResponse): rntme.contracts.storage.v1.GetFileResponse;

                    /**
                     * Encodes the specified GetFileResponse message. Does not implicitly {@link rntme.contracts.storage.v1.GetFileResponse.verify|verify} messages.
                     * @param message GetFileResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.storage.v1.IGetFileResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified GetFileResponse message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.GetFileResponse.verify|verify} messages.
                     * @param message GetFileResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.storage.v1.IGetFileResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a GetFileResponse message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns GetFileResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.storage.v1.GetFileResponse;

                    /**
                     * Decodes a GetFileResponse message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns GetFileResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.storage.v1.GetFileResponse;

                    /**
                     * Verifies a GetFileResponse message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a GetFileResponse message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns GetFileResponse
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.storage.v1.GetFileResponse;

                    /**
                     * Creates a plain object from a GetFileResponse message. Also converts values to other types if specified.
                     * @param message GetFileResponse
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.storage.v1.GetFileResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this GetFileResponse to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for GetFileResponse
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListFilesRequest. */
                interface IListFilesRequest {

                    /** ListFilesRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** ListFilesRequest route_id */
                    route_id?: (string|null);

                    /** ListFilesRequest entity_id */
                    entity_id?: (string|null);

                    /** ListFilesRequest limit */
                    limit?: (number|null);

                    /** ListFilesRequest page_token */
                    page_token?: (string|null);
                }

                /** Represents a ListFilesRequest. */
                class ListFilesRequest implements IListFilesRequest {

                    /**
                     * Constructs a new ListFilesRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.storage.v1.IListFilesRequest);

                    /** ListFilesRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** ListFilesRequest route_id. */
                    public route_id: string;

                    /** ListFilesRequest entity_id. */
                    public entity_id: string;

                    /** ListFilesRequest limit. */
                    public limit: number;

                    /** ListFilesRequest page_token. */
                    public page_token: string;

                    /**
                     * Creates a new ListFilesRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ListFilesRequest instance
                     */
                    public static create(properties?: rntme.contracts.storage.v1.IListFilesRequest): rntme.contracts.storage.v1.ListFilesRequest;

                    /**
                     * Encodes the specified ListFilesRequest message. Does not implicitly {@link rntme.contracts.storage.v1.ListFilesRequest.verify|verify} messages.
                     * @param message ListFilesRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.storage.v1.IListFilesRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ListFilesRequest message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.ListFilesRequest.verify|verify} messages.
                     * @param message ListFilesRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.storage.v1.IListFilesRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ListFilesRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ListFilesRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.storage.v1.ListFilesRequest;

                    /**
                     * Decodes a ListFilesRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ListFilesRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.storage.v1.ListFilesRequest;

                    /**
                     * Verifies a ListFilesRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ListFilesRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListFilesRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.storage.v1.ListFilesRequest;

                    /**
                     * Creates a plain object from a ListFilesRequest message. Also converts values to other types if specified.
                     * @param message ListFilesRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.storage.v1.ListFilesRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListFilesRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListFilesRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListFilesResponse. */
                interface IListFilesResponse {

                    /** ListFilesResponse files */
                    files?: (rntme.contracts.storage.v1.IFileMetadata[]|null);

                    /** ListFilesResponse next_page_token */
                    next_page_token?: (string|null);
                }

                /** Represents a ListFilesResponse. */
                class ListFilesResponse implements IListFilesResponse {

                    /**
                     * Constructs a new ListFilesResponse.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.storage.v1.IListFilesResponse);

                    /** ListFilesResponse files. */
                    public files: rntme.contracts.storage.v1.IFileMetadata[];

                    /** ListFilesResponse next_page_token. */
                    public next_page_token: string;

                    /**
                     * Creates a new ListFilesResponse instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ListFilesResponse instance
                     */
                    public static create(properties?: rntme.contracts.storage.v1.IListFilesResponse): rntme.contracts.storage.v1.ListFilesResponse;

                    /**
                     * Encodes the specified ListFilesResponse message. Does not implicitly {@link rntme.contracts.storage.v1.ListFilesResponse.verify|verify} messages.
                     * @param message ListFilesResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.storage.v1.IListFilesResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ListFilesResponse message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.ListFilesResponse.verify|verify} messages.
                     * @param message ListFilesResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.storage.v1.IListFilesResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ListFilesResponse message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ListFilesResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.storage.v1.ListFilesResponse;

                    /**
                     * Decodes a ListFilesResponse message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ListFilesResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.storage.v1.ListFilesResponse;

                    /**
                     * Verifies a ListFilesResponse message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ListFilesResponse message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListFilesResponse
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.storage.v1.ListFilesResponse;

                    /**
                     * Creates a plain object from a ListFilesResponse message. Also converts values to other types if specified.
                     * @param message ListFilesResponse
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.storage.v1.ListFilesResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListFilesResponse to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListFilesResponse
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a GetDownloadUrlRequest. */
                interface IGetDownloadUrlRequest {

                    /** GetDownloadUrlRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** GetDownloadUrlRequest file_id */
                    file_id?: (string|null);

                    /** GetDownloadUrlRequest ttl_sec */
                    ttl_sec?: (number|null);
                }

                /** Represents a GetDownloadUrlRequest. */
                class GetDownloadUrlRequest implements IGetDownloadUrlRequest {

                    /**
                     * Constructs a new GetDownloadUrlRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.storage.v1.IGetDownloadUrlRequest);

                    /** GetDownloadUrlRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** GetDownloadUrlRequest file_id. */
                    public file_id: string;

                    /** GetDownloadUrlRequest ttl_sec. */
                    public ttl_sec: number;

                    /**
                     * Creates a new GetDownloadUrlRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns GetDownloadUrlRequest instance
                     */
                    public static create(properties?: rntme.contracts.storage.v1.IGetDownloadUrlRequest): rntme.contracts.storage.v1.GetDownloadUrlRequest;

                    /**
                     * Encodes the specified GetDownloadUrlRequest message. Does not implicitly {@link rntme.contracts.storage.v1.GetDownloadUrlRequest.verify|verify} messages.
                     * @param message GetDownloadUrlRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.storage.v1.IGetDownloadUrlRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified GetDownloadUrlRequest message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.GetDownloadUrlRequest.verify|verify} messages.
                     * @param message GetDownloadUrlRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.storage.v1.IGetDownloadUrlRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a GetDownloadUrlRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns GetDownloadUrlRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.storage.v1.GetDownloadUrlRequest;

                    /**
                     * Decodes a GetDownloadUrlRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns GetDownloadUrlRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.storage.v1.GetDownloadUrlRequest;

                    /**
                     * Verifies a GetDownloadUrlRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a GetDownloadUrlRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns GetDownloadUrlRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.storage.v1.GetDownloadUrlRequest;

                    /**
                     * Creates a plain object from a GetDownloadUrlRequest message. Also converts values to other types if specified.
                     * @param message GetDownloadUrlRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.storage.v1.GetDownloadUrlRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this GetDownloadUrlRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for GetDownloadUrlRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a GetDownloadUrlResponse. */
                interface IGetDownloadUrlResponse {

                    /** GetDownloadUrlResponse presigned */
                    presigned?: (rntme.contracts.storage.v1.IPresignedRequest|null);
                }

                /** Represents a GetDownloadUrlResponse. */
                class GetDownloadUrlResponse implements IGetDownloadUrlResponse {

                    /**
                     * Constructs a new GetDownloadUrlResponse.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.storage.v1.IGetDownloadUrlResponse);

                    /** GetDownloadUrlResponse presigned. */
                    public presigned?: (rntme.contracts.storage.v1.IPresignedRequest|null);

                    /**
                     * Creates a new GetDownloadUrlResponse instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns GetDownloadUrlResponse instance
                     */
                    public static create(properties?: rntme.contracts.storage.v1.IGetDownloadUrlResponse): rntme.contracts.storage.v1.GetDownloadUrlResponse;

                    /**
                     * Encodes the specified GetDownloadUrlResponse message. Does not implicitly {@link rntme.contracts.storage.v1.GetDownloadUrlResponse.verify|verify} messages.
                     * @param message GetDownloadUrlResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.storage.v1.IGetDownloadUrlResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified GetDownloadUrlResponse message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.GetDownloadUrlResponse.verify|verify} messages.
                     * @param message GetDownloadUrlResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.storage.v1.IGetDownloadUrlResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a GetDownloadUrlResponse message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns GetDownloadUrlResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.storage.v1.GetDownloadUrlResponse;

                    /**
                     * Decodes a GetDownloadUrlResponse message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns GetDownloadUrlResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.storage.v1.GetDownloadUrlResponse;

                    /**
                     * Verifies a GetDownloadUrlResponse message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a GetDownloadUrlResponse message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns GetDownloadUrlResponse
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.storage.v1.GetDownloadUrlResponse;

                    /**
                     * Creates a plain object from a GetDownloadUrlResponse message. Also converts values to other types if specified.
                     * @param message GetDownloadUrlResponse
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.storage.v1.GetDownloadUrlResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this GetDownloadUrlResponse to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for GetDownloadUrlResponse
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a DeleteFileRequest. */
                interface IDeleteFileRequest {

                    /** DeleteFileRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** DeleteFileRequest file_id */
                    file_id?: (string|null);
                }

                /** Represents a DeleteFileRequest. */
                class DeleteFileRequest implements IDeleteFileRequest {

                    /**
                     * Constructs a new DeleteFileRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.storage.v1.IDeleteFileRequest);

                    /** DeleteFileRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** DeleteFileRequest file_id. */
                    public file_id: string;

                    /**
                     * Creates a new DeleteFileRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns DeleteFileRequest instance
                     */
                    public static create(properties?: rntme.contracts.storage.v1.IDeleteFileRequest): rntme.contracts.storage.v1.DeleteFileRequest;

                    /**
                     * Encodes the specified DeleteFileRequest message. Does not implicitly {@link rntme.contracts.storage.v1.DeleteFileRequest.verify|verify} messages.
                     * @param message DeleteFileRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.storage.v1.IDeleteFileRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified DeleteFileRequest message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.DeleteFileRequest.verify|verify} messages.
                     * @param message DeleteFileRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.storage.v1.IDeleteFileRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a DeleteFileRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns DeleteFileRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.storage.v1.DeleteFileRequest;

                    /**
                     * Decodes a DeleteFileRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns DeleteFileRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.storage.v1.DeleteFileRequest;

                    /**
                     * Verifies a DeleteFileRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a DeleteFileRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns DeleteFileRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.storage.v1.DeleteFileRequest;

                    /**
                     * Creates a plain object from a DeleteFileRequest message. Also converts values to other types if specified.
                     * @param message DeleteFileRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.storage.v1.DeleteFileRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this DeleteFileRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for DeleteFileRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a DeleteFileResponse. */
                interface IDeleteFileResponse {

                    /** DeleteFileResponse file */
                    file?: (rntme.contracts.storage.v1.IFileMetadata|null);
                }

                /** Represents a DeleteFileResponse. */
                class DeleteFileResponse implements IDeleteFileResponse {

                    /**
                     * Constructs a new DeleteFileResponse.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.storage.v1.IDeleteFileResponse);

                    /** DeleteFileResponse file. */
                    public file?: (rntme.contracts.storage.v1.IFileMetadata|null);

                    /**
                     * Creates a new DeleteFileResponse instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns DeleteFileResponse instance
                     */
                    public static create(properties?: rntme.contracts.storage.v1.IDeleteFileResponse): rntme.contracts.storage.v1.DeleteFileResponse;

                    /**
                     * Encodes the specified DeleteFileResponse message. Does not implicitly {@link rntme.contracts.storage.v1.DeleteFileResponse.verify|verify} messages.
                     * @param message DeleteFileResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.storage.v1.IDeleteFileResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified DeleteFileResponse message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.DeleteFileResponse.verify|verify} messages.
                     * @param message DeleteFileResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.storage.v1.IDeleteFileResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a DeleteFileResponse message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns DeleteFileResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.storage.v1.DeleteFileResponse;

                    /**
                     * Decodes a DeleteFileResponse message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns DeleteFileResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.storage.v1.DeleteFileResponse;

                    /**
                     * Verifies a DeleteFileResponse message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a DeleteFileResponse message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns DeleteFileResponse
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.storage.v1.DeleteFileResponse;

                    /**
                     * Creates a plain object from a DeleteFileResponse message. Also converts values to other types if specified.
                     * @param message DeleteFileResponse
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.storage.v1.DeleteFileResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this DeleteFileResponse to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for DeleteFileResponse
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Represents a StorageModule */
                class StorageModule extends $protobuf.rpc.Service {

                    /**
                     * Constructs a new StorageModule service.
                     * @param rpcImpl RPC implementation
                     * @param [requestDelimited=false] Whether requests are length-delimited
                     * @param [responseDelimited=false] Whether responses are length-delimited
                     */
                    constructor(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean);

                    /**
                     * Creates new StorageModule service using the specified rpc implementation.
                     * @param rpcImpl RPC implementation
                     * @param [requestDelimited=false] Whether requests are length-delimited
                     * @param [responseDelimited=false] Whether responses are length-delimited
                     * @returns RPC service. Useful where requests and/or responses are streamed.
                     */
                    public static create(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean): StorageModule;

                    /**
                     * Calls PrepareUpload.
                     * @param request PrepareUploadRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and PrepareUploadResponse
                     */
                    public prepareUpload(request: rntme.contracts.storage.v1.IPrepareUploadRequest, callback: rntme.contracts.storage.v1.StorageModule.PrepareUploadCallback): void;

                    /**
                     * Calls PrepareUpload.
                     * @param request PrepareUploadRequest message or plain object
                     * @returns Promise
                     */
                    public prepareUpload(request: rntme.contracts.storage.v1.IPrepareUploadRequest): Promise<rntme.contracts.storage.v1.PrepareUploadResponse>;

                    /**
                     * Calls CommitUpload.
                     * @param request CommitUploadRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and CommitUploadResponse
                     */
                    public commitUpload(request: rntme.contracts.storage.v1.ICommitUploadRequest, callback: rntme.contracts.storage.v1.StorageModule.CommitUploadCallback): void;

                    /**
                     * Calls CommitUpload.
                     * @param request CommitUploadRequest message or plain object
                     * @returns Promise
                     */
                    public commitUpload(request: rntme.contracts.storage.v1.ICommitUploadRequest): Promise<rntme.contracts.storage.v1.CommitUploadResponse>;

                    /**
                     * Calls AbortUpload.
                     * @param request AbortUploadRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and AbortUploadResponse
                     */
                    public abortUpload(request: rntme.contracts.storage.v1.IAbortUploadRequest, callback: rntme.contracts.storage.v1.StorageModule.AbortUploadCallback): void;

                    /**
                     * Calls AbortUpload.
                     * @param request AbortUploadRequest message or plain object
                     * @returns Promise
                     */
                    public abortUpload(request: rntme.contracts.storage.v1.IAbortUploadRequest): Promise<rntme.contracts.storage.v1.AbortUploadResponse>;

                    /**
                     * Calls GetFile.
                     * @param request GetFileRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and GetFileResponse
                     */
                    public getFile(request: rntme.contracts.storage.v1.IGetFileRequest, callback: rntme.contracts.storage.v1.StorageModule.GetFileCallback): void;

                    /**
                     * Calls GetFile.
                     * @param request GetFileRequest message or plain object
                     * @returns Promise
                     */
                    public getFile(request: rntme.contracts.storage.v1.IGetFileRequest): Promise<rntme.contracts.storage.v1.GetFileResponse>;

                    /**
                     * Calls ListFiles.
                     * @param request ListFilesRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and ListFilesResponse
                     */
                    public listFiles(request: rntme.contracts.storage.v1.IListFilesRequest, callback: rntme.contracts.storage.v1.StorageModule.ListFilesCallback): void;

                    /**
                     * Calls ListFiles.
                     * @param request ListFilesRequest message or plain object
                     * @returns Promise
                     */
                    public listFiles(request: rntme.contracts.storage.v1.IListFilesRequest): Promise<rntme.contracts.storage.v1.ListFilesResponse>;

                    /**
                     * Calls GetDownloadUrl.
                     * @param request GetDownloadUrlRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and GetDownloadUrlResponse
                     */
                    public getDownloadUrl(request: rntme.contracts.storage.v1.IGetDownloadUrlRequest, callback: rntme.contracts.storage.v1.StorageModule.GetDownloadUrlCallback): void;

                    /**
                     * Calls GetDownloadUrl.
                     * @param request GetDownloadUrlRequest message or plain object
                     * @returns Promise
                     */
                    public getDownloadUrl(request: rntme.contracts.storage.v1.IGetDownloadUrlRequest): Promise<rntme.contracts.storage.v1.GetDownloadUrlResponse>;

                    /**
                     * Calls DeleteFile.
                     * @param request DeleteFileRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and DeleteFileResponse
                     */
                    public deleteFile(request: rntme.contracts.storage.v1.IDeleteFileRequest, callback: rntme.contracts.storage.v1.StorageModule.DeleteFileCallback): void;

                    /**
                     * Calls DeleteFile.
                     * @param request DeleteFileRequest message or plain object
                     * @returns Promise
                     */
                    public deleteFile(request: rntme.contracts.storage.v1.IDeleteFileRequest): Promise<rntme.contracts.storage.v1.DeleteFileResponse>;
                }

                namespace StorageModule {

                    /**
                     * Callback as used by {@link rntme.contracts.storage.v1.StorageModule#prepareUpload}.
                     * @param error Error, if any
                     * @param [response] PrepareUploadResponse
                     */
                    type PrepareUploadCallback = (error: (Error|null), response?: rntme.contracts.storage.v1.PrepareUploadResponse) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.storage.v1.StorageModule#commitUpload}.
                     * @param error Error, if any
                     * @param [response] CommitUploadResponse
                     */
                    type CommitUploadCallback = (error: (Error|null), response?: rntme.contracts.storage.v1.CommitUploadResponse) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.storage.v1.StorageModule#abortUpload}.
                     * @param error Error, if any
                     * @param [response] AbortUploadResponse
                     */
                    type AbortUploadCallback = (error: (Error|null), response?: rntme.contracts.storage.v1.AbortUploadResponse) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.storage.v1.StorageModule#getFile}.
                     * @param error Error, if any
                     * @param [response] GetFileResponse
                     */
                    type GetFileCallback = (error: (Error|null), response?: rntme.contracts.storage.v1.GetFileResponse) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.storage.v1.StorageModule#listFiles}.
                     * @param error Error, if any
                     * @param [response] ListFilesResponse
                     */
                    type ListFilesCallback = (error: (Error|null), response?: rntme.contracts.storage.v1.ListFilesResponse) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.storage.v1.StorageModule#getDownloadUrl}.
                     * @param error Error, if any
                     * @param [response] GetDownloadUrlResponse
                     */
                    type GetDownloadUrlCallback = (error: (Error|null), response?: rntme.contracts.storage.v1.GetDownloadUrlResponse) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.storage.v1.StorageModule#deleteFile}.
                     * @param error Error, if any
                     * @param [response] DeleteFileResponse
                     */
                    type DeleteFileCallback = (error: (Error|null), response?: rntme.contracts.storage.v1.DeleteFileResponse) => void;
                }
            }
        }

        /** Namespace common. */
        namespace common {

            /** Namespace v1. */
            namespace v1 {

                /** Properties of a CanonicalRef. */
                interface ICanonicalRef {

                    /** CanonicalRef canonical_id */
                    canonical_id?: (string|null);

                    /** CanonicalRef vendor_id */
                    vendor_id?: (string|null);

                    /** CanonicalRef module_name */
                    module_name?: (string|null);

                    /** CanonicalRef module_version */
                    module_version?: (string|null);

                    /** CanonicalRef contract_version */
                    contract_version?: (string|null);
                }

                /** Represents a CanonicalRef. */
                class CanonicalRef implements ICanonicalRef {

                    /**
                     * Constructs a new CanonicalRef.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.common.v1.ICanonicalRef);

                    /** CanonicalRef canonical_id. */
                    public canonical_id: string;

                    /** CanonicalRef vendor_id. */
                    public vendor_id: string;

                    /** CanonicalRef module_name. */
                    public module_name: string;

                    /** CanonicalRef module_version. */
                    public module_version: string;

                    /** CanonicalRef contract_version. */
                    public contract_version: string;

                    /**
                     * Creates a new CanonicalRef instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CanonicalRef instance
                     */
                    public static create(properties?: rntme.contracts.common.v1.ICanonicalRef): rntme.contracts.common.v1.CanonicalRef;

                    /**
                     * Encodes the specified CanonicalRef message. Does not implicitly {@link rntme.contracts.common.v1.CanonicalRef.verify|verify} messages.
                     * @param message CanonicalRef message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.common.v1.ICanonicalRef, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CanonicalRef message, length delimited. Does not implicitly {@link rntme.contracts.common.v1.CanonicalRef.verify|verify} messages.
                     * @param message CanonicalRef message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.common.v1.ICanonicalRef, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CanonicalRef message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CanonicalRef
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.common.v1.CanonicalRef;

                    /**
                     * Decodes a CanonicalRef message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CanonicalRef
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.common.v1.CanonicalRef;

                    /**
                     * Verifies a CanonicalRef message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CanonicalRef message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CanonicalRef
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.common.v1.CanonicalRef;

                    /**
                     * Creates a plain object from a CanonicalRef message. Also converts values to other types if specified.
                     * @param message CanonicalRef
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.common.v1.CanonicalRef, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CanonicalRef to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CanonicalRef
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CommandContext. */
                interface ICommandContext {

                    /** CommandContext idempotency_key */
                    idempotency_key?: (string|null);

                    /** CommandContext correlation_id */
                    correlation_id?: (string|null);

                    /** CommandContext actor_user_id */
                    actor_user_id?: (string|null);

                    /** CommandContext actor_type */
                    actor_type?: (string|null);

                    /** CommandContext tenant_id */
                    tenant_id?: (string|null);
                }

                /** Represents a CommandContext. */
                class CommandContext implements ICommandContext {

                    /**
                     * Constructs a new CommandContext.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.common.v1.ICommandContext);

                    /** CommandContext idempotency_key. */
                    public idempotency_key: string;

                    /** CommandContext correlation_id. */
                    public correlation_id: string;

                    /** CommandContext actor_user_id. */
                    public actor_user_id: string;

                    /** CommandContext actor_type. */
                    public actor_type: string;

                    /** CommandContext tenant_id. */
                    public tenant_id: string;

                    /**
                     * Creates a new CommandContext instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CommandContext instance
                     */
                    public static create(properties?: rntme.contracts.common.v1.ICommandContext): rntme.contracts.common.v1.CommandContext;

                    /**
                     * Encodes the specified CommandContext message. Does not implicitly {@link rntme.contracts.common.v1.CommandContext.verify|verify} messages.
                     * @param message CommandContext message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.common.v1.ICommandContext, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CommandContext message, length delimited. Does not implicitly {@link rntme.contracts.common.v1.CommandContext.verify|verify} messages.
                     * @param message CommandContext message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.common.v1.ICommandContext, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CommandContext message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CommandContext
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.common.v1.CommandContext;

                    /**
                     * Decodes a CommandContext message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CommandContext
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.common.v1.CommandContext;

                    /**
                     * Verifies a CommandContext message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CommandContext message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CommandContext
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.common.v1.CommandContext;

                    /**
                     * Creates a plain object from a CommandContext message. Also converts values to other types if specified.
                     * @param message CommandContext
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.common.v1.CommandContext, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CommandContext to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CommandContext
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a Name. */
                interface IName {

                    /** Name given */
                    given?: (string|null);

                    /** Name family */
                    family?: (string|null);

                    /** Name display */
                    display?: (string|null);
                }

                /** Represents a Name. */
                class Name implements IName {

                    /**
                     * Constructs a new Name.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.common.v1.IName);

                    /** Name given. */
                    public given: string;

                    /** Name family. */
                    public family: string;

                    /** Name display. */
                    public display: string;

                    /**
                     * Creates a new Name instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Name instance
                     */
                    public static create(properties?: rntme.contracts.common.v1.IName): rntme.contracts.common.v1.Name;

                    /**
                     * Encodes the specified Name message. Does not implicitly {@link rntme.contracts.common.v1.Name.verify|verify} messages.
                     * @param message Name message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.common.v1.IName, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Name message, length delimited. Does not implicitly {@link rntme.contracts.common.v1.Name.verify|verify} messages.
                     * @param message Name message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.common.v1.IName, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Name message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Name
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.common.v1.Name;

                    /**
                     * Decodes a Name message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Name
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.common.v1.Name;

                    /**
                     * Verifies a Name message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Name message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Name
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.common.v1.Name;

                    /**
                     * Creates a plain object from a Name message. Also converts values to other types if specified.
                     * @param message Name
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.common.v1.Name, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Name to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Name
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListRequest. */
                interface IListRequest {

                    /** ListRequest limit */
                    limit?: (number|null);

                    /** ListRequest cursor */
                    cursor?: (string|null);

                    /** ListRequest offset */
                    offset?: (number|null);

                    /** ListRequest filters */
                    filters?: (rntme.contracts.common.v1.IFilter[]|null);

                    /** ListRequest sorts */
                    sorts?: (rntme.contracts.common.v1.ISort[]|null);
                }

                /** Represents a ListRequest. */
                class ListRequest implements IListRequest {

                    /**
                     * Constructs a new ListRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.common.v1.IListRequest);

                    /** ListRequest limit. */
                    public limit: number;

                    /** ListRequest cursor. */
                    public cursor: string;

                    /** ListRequest offset. */
                    public offset: number;

                    /** ListRequest filters. */
                    public filters: rntme.contracts.common.v1.IFilter[];

                    /** ListRequest sorts. */
                    public sorts: rntme.contracts.common.v1.ISort[];

                    /**
                     * Creates a new ListRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ListRequest instance
                     */
                    public static create(properties?: rntme.contracts.common.v1.IListRequest): rntme.contracts.common.v1.ListRequest;

                    /**
                     * Encodes the specified ListRequest message. Does not implicitly {@link rntme.contracts.common.v1.ListRequest.verify|verify} messages.
                     * @param message ListRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.common.v1.IListRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ListRequest message, length delimited. Does not implicitly {@link rntme.contracts.common.v1.ListRequest.verify|verify} messages.
                     * @param message ListRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.common.v1.IListRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ListRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ListRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.common.v1.ListRequest;

                    /**
                     * Decodes a ListRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ListRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.common.v1.ListRequest;

                    /**
                     * Verifies a ListRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ListRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.common.v1.ListRequest;

                    /**
                     * Creates a plain object from a ListRequest message. Also converts values to other types if specified.
                     * @param message ListRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.common.v1.ListRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a Filter. */
                interface IFilter {

                    /** Filter field */
                    field?: (string|null);

                    /** Filter operator */
                    operator?: (rntme.contracts.common.v1.FilterOperator|null);

                    /** Filter value */
                    value?: (string|null);

                    /** Filter values */
                    values?: (string[]|null);
                }

                /** Represents a Filter. */
                class Filter implements IFilter {

                    /**
                     * Constructs a new Filter.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.common.v1.IFilter);

                    /** Filter field. */
                    public field: string;

                    /** Filter operator. */
                    public operator: rntme.contracts.common.v1.FilterOperator;

                    /** Filter value. */
                    public value: string;

                    /** Filter values. */
                    public values: string[];

                    /**
                     * Creates a new Filter instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Filter instance
                     */
                    public static create(properties?: rntme.contracts.common.v1.IFilter): rntme.contracts.common.v1.Filter;

                    /**
                     * Encodes the specified Filter message. Does not implicitly {@link rntme.contracts.common.v1.Filter.verify|verify} messages.
                     * @param message Filter message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.common.v1.IFilter, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Filter message, length delimited. Does not implicitly {@link rntme.contracts.common.v1.Filter.verify|verify} messages.
                     * @param message Filter message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.common.v1.IFilter, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Filter message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Filter
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.common.v1.Filter;

                    /**
                     * Decodes a Filter message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Filter
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.common.v1.Filter;

                    /**
                     * Verifies a Filter message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Filter message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Filter
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.common.v1.Filter;

                    /**
                     * Creates a plain object from a Filter message. Also converts values to other types if specified.
                     * @param message Filter
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.common.v1.Filter, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Filter to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Filter
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** FilterOperator enum. */
                enum FilterOperator {
                    FILTER_OPERATOR_UNSPECIFIED = 0,
                    FILTER_OPERATOR_EQ = 1,
                    FILTER_OPERATOR_NEQ = 2,
                    FILTER_OPERATOR_GT = 3,
                    FILTER_OPERATOR_GTE = 4,
                    FILTER_OPERATOR_LT = 5,
                    FILTER_OPERATOR_LTE = 6,
                    FILTER_OPERATOR_IN = 7,
                    FILTER_OPERATOR_NOT_IN = 8,
                    FILTER_OPERATOR_CONTAINS = 9,
                    FILTER_OPERATOR_PREFIX = 10,
                    FILTER_OPERATOR_SUFFIX = 11
                }

                /** Properties of a Sort. */
                interface ISort {

                    /** Sort field */
                    field?: (string|null);

                    /** Sort direction */
                    direction?: (rntme.contracts.common.v1.SortDirection|null);
                }

                /** Represents a Sort. */
                class Sort implements ISort {

                    /**
                     * Constructs a new Sort.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.common.v1.ISort);

                    /** Sort field. */
                    public field: string;

                    /** Sort direction. */
                    public direction: rntme.contracts.common.v1.SortDirection;

                    /**
                     * Creates a new Sort instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Sort instance
                     */
                    public static create(properties?: rntme.contracts.common.v1.ISort): rntme.contracts.common.v1.Sort;

                    /**
                     * Encodes the specified Sort message. Does not implicitly {@link rntme.contracts.common.v1.Sort.verify|verify} messages.
                     * @param message Sort message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.common.v1.ISort, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Sort message, length delimited. Does not implicitly {@link rntme.contracts.common.v1.Sort.verify|verify} messages.
                     * @param message Sort message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.common.v1.ISort, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Sort message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Sort
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.common.v1.Sort;

                    /**
                     * Decodes a Sort message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Sort
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.common.v1.Sort;

                    /**
                     * Verifies a Sort message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Sort message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Sort
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.common.v1.Sort;

                    /**
                     * Creates a plain object from a Sort message. Also converts values to other types if specified.
                     * @param message Sort
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.common.v1.Sort, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Sort to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Sort
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** SortDirection enum. */
                enum SortDirection {
                    SORT_DIRECTION_UNSPECIFIED = 0,
                    SORT_DIRECTION_ASC = 1,
                    SORT_DIRECTION_DESC = 2
                }

                /** Properties of a ListResponseMeta. */
                interface IListResponseMeta {

                    /** ListResponseMeta limit */
                    limit?: (number|null);

                    /** ListResponseMeta next_cursor */
                    next_cursor?: (string|null);

                    /** ListResponseMeta prev_cursor */
                    prev_cursor?: (string|null);

                    /** ListResponseMeta total_count */
                    total_count?: (number|null);

                    /** ListResponseMeta has_more */
                    has_more?: (boolean|null);
                }

                /** Represents a ListResponseMeta. */
                class ListResponseMeta implements IListResponseMeta {

                    /**
                     * Constructs a new ListResponseMeta.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.common.v1.IListResponseMeta);

                    /** ListResponseMeta limit. */
                    public limit: number;

                    /** ListResponseMeta next_cursor. */
                    public next_cursor: string;

                    /** ListResponseMeta prev_cursor. */
                    public prev_cursor: string;

                    /** ListResponseMeta total_count. */
                    public total_count: number;

                    /** ListResponseMeta has_more. */
                    public has_more: boolean;

                    /**
                     * Creates a new ListResponseMeta instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ListResponseMeta instance
                     */
                    public static create(properties?: rntme.contracts.common.v1.IListResponseMeta): rntme.contracts.common.v1.ListResponseMeta;

                    /**
                     * Encodes the specified ListResponseMeta message. Does not implicitly {@link rntme.contracts.common.v1.ListResponseMeta.verify|verify} messages.
                     * @param message ListResponseMeta message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.common.v1.IListResponseMeta, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ListResponseMeta message, length delimited. Does not implicitly {@link rntme.contracts.common.v1.ListResponseMeta.verify|verify} messages.
                     * @param message ListResponseMeta message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.common.v1.IListResponseMeta, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ListResponseMeta message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ListResponseMeta
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.common.v1.ListResponseMeta;

                    /**
                     * Decodes a ListResponseMeta message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ListResponseMeta
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.common.v1.ListResponseMeta;

                    /**
                     * Verifies a ListResponseMeta message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ListResponseMeta message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListResponseMeta
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.common.v1.ListResponseMeta;

                    /**
                     * Creates a plain object from a ListResponseMeta message. Also converts values to other types if specified.
                     * @param message ListResponseMeta
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.common.v1.ListResponseMeta, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListResponseMeta to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListResponseMeta
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a Metadata. */
                interface IMetadata {

                    /** Metadata public */
                    "public"?: (google.protobuf.IStruct|null);

                    /** Metadata private */
                    "private"?: (google.protobuf.IStruct|null);

                    /** Metadata unsafe */
                    unsafe?: (google.protobuf.IStruct|null);
                }

                /** Represents a Metadata. */
                class Metadata implements IMetadata {

                    /**
                     * Constructs a new Metadata.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.common.v1.IMetadata);

                    /** Metadata public. */
                    public public?: (google.protobuf.IStruct|null);

                    /** Metadata private. */
                    public private?: (google.protobuf.IStruct|null);

                    /** Metadata unsafe. */
                    public unsafe?: (google.protobuf.IStruct|null);

                    /**
                     * Creates a new Metadata instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Metadata instance
                     */
                    public static create(properties?: rntme.contracts.common.v1.IMetadata): rntme.contracts.common.v1.Metadata;

                    /**
                     * Encodes the specified Metadata message. Does not implicitly {@link rntme.contracts.common.v1.Metadata.verify|verify} messages.
                     * @param message Metadata message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.common.v1.IMetadata, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Metadata message, length delimited. Does not implicitly {@link rntme.contracts.common.v1.Metadata.verify|verify} messages.
                     * @param message Metadata message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.common.v1.IMetadata, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Metadata message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Metadata
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.common.v1.Metadata;

                    /**
                     * Decodes a Metadata message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Metadata
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.common.v1.Metadata;

                    /**
                     * Verifies a Metadata message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Metadata message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Metadata
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.common.v1.Metadata;

                    /**
                     * Creates a plain object from a Metadata message. Also converts values to other types if specified.
                     * @param message Metadata
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.common.v1.Metadata, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Metadata to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Metadata
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }
            }
        }
    }
}

/** Namespace google. */
export namespace google {

    /** Namespace protobuf. */
    namespace protobuf {

        /** Properties of a Timestamp. */
        interface ITimestamp {

            /** Timestamp seconds */
            seconds?: (number|Long|null);

            /** Timestamp nanos */
            nanos?: (number|null);
        }

        /** Represents a Timestamp. */
        class Timestamp implements ITimestamp {

            /**
             * Constructs a new Timestamp.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.ITimestamp);

            /** Timestamp seconds. */
            public seconds: (number|Long);

            /** Timestamp nanos. */
            public nanos: number;

            /**
             * Creates a new Timestamp instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Timestamp instance
             */
            public static create(properties?: google.protobuf.ITimestamp): google.protobuf.Timestamp;

            /**
             * Encodes the specified Timestamp message. Does not implicitly {@link google.protobuf.Timestamp.verify|verify} messages.
             * @param message Timestamp message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.ITimestamp, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Timestamp message, length delimited. Does not implicitly {@link google.protobuf.Timestamp.verify|verify} messages.
             * @param message Timestamp message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.ITimestamp, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Timestamp message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Timestamp
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.Timestamp;

            /**
             * Decodes a Timestamp message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Timestamp
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.Timestamp;

            /**
             * Verifies a Timestamp message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a Timestamp message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Timestamp
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.Timestamp;

            /**
             * Creates a plain object from a Timestamp message. Also converts values to other types if specified.
             * @param message Timestamp
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.Timestamp, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Timestamp to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Timestamp
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a Struct. */
        interface IStruct {

            /** Struct fields */
            fields?: ({ [k: string]: google.protobuf.IValue }|null);
        }

        /** Represents a Struct. */
        class Struct implements IStruct {

            /**
             * Constructs a new Struct.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IStruct);

            /** Struct fields. */
            public fields: { [k: string]: google.protobuf.IValue };

            /**
             * Creates a new Struct instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Struct instance
             */
            public static create(properties?: google.protobuf.IStruct): google.protobuf.Struct;

            /**
             * Encodes the specified Struct message. Does not implicitly {@link google.protobuf.Struct.verify|verify} messages.
             * @param message Struct message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IStruct, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Struct message, length delimited. Does not implicitly {@link google.protobuf.Struct.verify|verify} messages.
             * @param message Struct message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IStruct, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Struct message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Struct
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.Struct;

            /**
             * Decodes a Struct message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Struct
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.Struct;

            /**
             * Verifies a Struct message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a Struct message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Struct
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.Struct;

            /**
             * Creates a plain object from a Struct message. Also converts values to other types if specified.
             * @param message Struct
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.Struct, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Struct to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Struct
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a Value. */
        interface IValue {

            /** Value nullValue */
            nullValue?: (google.protobuf.NullValue|null);

            /** Value numberValue */
            numberValue?: (number|null);

            /** Value stringValue */
            stringValue?: (string|null);

            /** Value boolValue */
            boolValue?: (boolean|null);

            /** Value structValue */
            structValue?: (google.protobuf.IStruct|null);

            /** Value listValue */
            listValue?: (google.protobuf.IListValue|null);
        }

        /** Represents a Value. */
        class Value implements IValue {

            /**
             * Constructs a new Value.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IValue);

            /** Value nullValue. */
            public nullValue?: (google.protobuf.NullValue|null);

            /** Value numberValue. */
            public numberValue?: (number|null);

            /** Value stringValue. */
            public stringValue?: (string|null);

            /** Value boolValue. */
            public boolValue?: (boolean|null);

            /** Value structValue. */
            public structValue?: (google.protobuf.IStruct|null);

            /** Value listValue. */
            public listValue?: (google.protobuf.IListValue|null);

            /** Value kind. */
            public kind?: ("nullValue"|"numberValue"|"stringValue"|"boolValue"|"structValue"|"listValue");

            /**
             * Creates a new Value instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Value instance
             */
            public static create(properties?: google.protobuf.IValue): google.protobuf.Value;

            /**
             * Encodes the specified Value message. Does not implicitly {@link google.protobuf.Value.verify|verify} messages.
             * @param message Value message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IValue, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Value message, length delimited. Does not implicitly {@link google.protobuf.Value.verify|verify} messages.
             * @param message Value message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IValue, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Value message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Value
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.Value;

            /**
             * Decodes a Value message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Value
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.Value;

            /**
             * Verifies a Value message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a Value message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Value
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.Value;

            /**
             * Creates a plain object from a Value message. Also converts values to other types if specified.
             * @param message Value
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.Value, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Value to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Value
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** NullValue enum. */
        enum NullValue {
            NULL_VALUE = 0
        }

        /** Properties of a ListValue. */
        interface IListValue {

            /** ListValue values */
            values?: (google.protobuf.IValue[]|null);
        }

        /** Represents a ListValue. */
        class ListValue implements IListValue {

            /**
             * Constructs a new ListValue.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IListValue);

            /** ListValue values. */
            public values: google.protobuf.IValue[];

            /**
             * Creates a new ListValue instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ListValue instance
             */
            public static create(properties?: google.protobuf.IListValue): google.protobuf.ListValue;

            /**
             * Encodes the specified ListValue message. Does not implicitly {@link google.protobuf.ListValue.verify|verify} messages.
             * @param message ListValue message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IListValue, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified ListValue message, length delimited. Does not implicitly {@link google.protobuf.ListValue.verify|verify} messages.
             * @param message ListValue message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IListValue, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a ListValue message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns ListValue
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.ListValue;

            /**
             * Decodes a ListValue message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns ListValue
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.ListValue;

            /**
             * Verifies a ListValue message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a ListValue message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns ListValue
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.ListValue;

            /**
             * Creates a plain object from a ListValue message. Also converts values to other types if specified.
             * @param message ListValue
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.ListValue, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this ListValue to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for ListValue
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }
    }
}
