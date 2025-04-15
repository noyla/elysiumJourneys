export class BookingRecord {
    userId?: string;
    bookingId?: string;
    status?: string;
    authorizedProviderCode?: string;
    resourceId?: string;
    bookingAmount?: bigint;
    transactionHash?: string;
    bookingStartDate?: Date;
    bookingEndDate?: Date;
    createdAt?: Date;
    updatedAt?: Date;
    errorMessage?: string;

}

export enum BookingStatus {
    Pending,
    Confirmed,
    Cancelled,
    Disputed,
    Resolved
}