// Welcome to VaporEdit.
// Java Environment

public class heelo {
    public static void main(String[] args) {
    int x=0;
    int reversedNum = 0;
    int originalNum = x;

    while (x > 0) {
        int lastDigit = x % 10;
        reversedNum = (reversedNum * 10) + lastDigit;
        x = x / 10;
    }

    if (originalNum == reversedNum) {
        System.out.println(originalNum + " is a palindrome.");
    } else {
        System.out.println(originalNum + " is not a palindrome.");
    }
    
}
}