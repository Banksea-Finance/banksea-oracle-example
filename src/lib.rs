use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    borsh::try_from_slice_unchecked,
};

#[derive(BorshSerialize, BorshDeserialize)]
pub struct Answer {
    pub code: String,
    pub unit: String,
    pub decimals: u64,
    pub aggregate_time: u64,

    pub floor_price: u64,
    pub ai_floor_price: u64,
    pub avg_price: u64,
}

entrypoint!(process_instruction);
fn process_instruction(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    _instruction_data: &[u8],
) -> ProgramResult {
            let accounts_iter = &mut accounts.iter();

            let feed_account = next_account_info(accounts_iter)?;
            let answer_account = next_account_info(accounts_iter)?;
        
            let feed_info = banksea_oracle::get_feed_info(feed_account)?;
            let mut answer_info: Answer = try_from_slice_unchecked(&answer_account.data.borrow())?;
            answer_info.unit = feed_info.unit;
            answer_info.code = feed_info.code;
            answer_info.decimals = feed_info.decimals;
            answer_info.floor_price = feed_info.floor_price;
            answer_info.avg_price = feed_info.avg_price;
            answer_info.ai_floor_price = feed_info.ai_floor_price;
            answer_info.aggregate_time = feed_info.aggregate_time;
            answer_info.serialize(&mut &mut answer_account.data.borrow_mut()[..])?;
    
    Ok(())
}